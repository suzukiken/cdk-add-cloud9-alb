import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets/lib';

export class CdkAddCloud9AlbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const alb_arn = this.node.tryGetContext('alb_arn')
    const domain = this.node.tryGetContext('domain')
    const subdomain_c9 = this.node.tryGetContext('subdomain_c9')
    const subdomain_c98 = this.node.tryGetContext('subdomain_c98')
    const instance_id = this.node.tryGetContext('cloud9_instance_id')
    const host_c9 = subdomain_c9 + '.' + domain
    const host_c98 = subdomain_c98 + '.' + domain
    const vpc_id = this.node.tryGetContext('vpc_id')
    const vpc_name = this.node.tryGetContext('vpc_name')
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: vpc_id, vpcName: vpc_name })
    const instance_securitygroup_id = this.node.tryGetContext('cloud9_instance_securitygroup_id')
    const instance_security_group = ec2.SecurityGroup.fromSecurityGroupId(this, 'InsSecurityGrp', instance_securitygroup_id)
    const lb_securitygroup_id = cdk.Fn.importValue(this.node.tryGetContext('lb_securitygroupid_exportname'))
    const lb_security_group = ec2.SecurityGroup.fromSecurityGroupId(this, 'LbSecurityGrp', lb_securitygroup_id)
    
    instance_security_group.addIngressRule(lb_security_group, ec2.Port.tcp(80))
    instance_security_group.addIngressRule(lb_security_group, ec2.Port.tcp(8080))
    
    const alb = elbv2.ApplicationLoadBalancer.fromLookup(this, 'Alb', {
      loadBalancerArn: alb_arn
    })
    
    const listener443 = elbv2.ApplicationListener.fromLookup(this, 'HttpsListener', {
      listenerArn: this.node.tryGetContext('alb_https_listener_arn')
    })
    
    const listener80 = elbv2.ApplicationListener.fromLookup(this, 'HttpListener', {
      listenerArn: this.node.tryGetContext('alb_http_listener_arn')
    })
    
    const instance_target_80 = new elbv2.InstanceTarget(instance_id, 80)
    const instance_target_8080 = new elbv2.InstanceTarget(instance_id, 8080)
    
    const targetGroup_c9 = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      port: 80,
      targets: [instance_target_80],
      vpc: vpc
    })
    
    const targetGroup_c98 = new elbv2.ApplicationTargetGroup(this, 'TargetGroupC98', {
      port: 8080,
      targets: [instance_target_8080],
      vpc: vpc
    })
    
    listener443.addTargetGroups('Groups', {
      targetGroups: [targetGroup_c9], 
      conditions: [
         elbv2.ListenerCondition.hostHeaders([host_c9])  
      ],
      priority: 1000
    })
    
    listener80.addTargetGroups('Groups80', {
      targetGroups: [targetGroup_c9], 
      conditions: [
         elbv2.ListenerCondition.hostHeaders([host_c9])  
      ],
      priority: 1000
    })
    
    listener443.addTargetGroups('Groups443C98', {
      targetGroups: [targetGroup_c98], 
      conditions: [
         elbv2.ListenerCondition.hostHeaders([host_c98])  
      ],
      priority: 1001
    })
    
    listener80.addTargetGroups('Groups80C98', {
      targetGroups: [targetGroup_c98], 
      conditions: [
         elbv2.ListenerCondition.hostHeaders([host_c98])  
      ],
      priority: 1001
    })
    
    const zone = route53.HostedZone.fromLookup(this, "zone", {
      domainName: domain,
    })
    
    const record_c9 = new route53.ARecord(this, "record", {
      recordName: subdomain_c9,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(alb)
      ),
      zone: zone,
    })
    
    const record_c98 = new route53.ARecord(this, "record_c98", {
      recordName: subdomain_c98,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(alb)
      ),
      zone: zone,
    })
    
  }
}
