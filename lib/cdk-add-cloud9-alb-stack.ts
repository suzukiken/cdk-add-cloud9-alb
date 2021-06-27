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
    const subdomain = this.node.tryGetContext('subdomain')
    const instance_id = this.node.tryGetContext('cloud9_instance_id')
    const host = subdomain + '.' + domain
    const vpc_id = this.node.tryGetContext('vpc_id')
    const vpc_name = this.node.tryGetContext('vpc_name')
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: vpc_id, vpcName: vpc_name })
    const instance_securitygroup_id = this.node.tryGetContext('cloud9_instance_securitygroup_id')
    const instance_security_group = ec2.SecurityGroup.fromSecurityGroupId(this, 'InsSecurityGrp', instance_securitygroup_id)
    const lb_securitygroup_id = cdk.Fn.importValue(this.node.tryGetContext('lb_securitygroupid_exportname'))
    const lb_security_group = ec2.SecurityGroup.fromSecurityGroupId(this, 'LbSecurityGrp', lb_securitygroup_id)
    instance_security_group.addIngressRule(lb_security_group, ec2.Port.tcp(80))
    
    const alb = elbv2.ApplicationLoadBalancer.fromLookup(this, 'Alb', {
      loadBalancerArn: alb_arn
    })
    
    const listener443 = elbv2.ApplicationListener.fromLookup(this, 'HttpsListener', {
      listenerArn: this.node.tryGetContext('alb_https_listener_arn')
    })
    
    const listener80 = elbv2.ApplicationListener.fromLookup(this, 'HttpListener', {
      listenerArn: this.node.tryGetContext('alb_http_listener_arn')
    })
    
    const instance_target = new elbv2.InstanceTarget(instance_id, 80)
    
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      port: 80,
      targets: [instance_target],
      vpc: vpc
    })
    
    listener443.addTargetGroups('Groups', {
      targetGroups: [targetGroup], 
      conditions: [
         elbv2.ListenerCondition.hostHeaders([host])  
      ],
      priority: 1000
    })
    
    listener80.addTargetGroups('Groups80', {
      targetGroups: [targetGroup], 
      conditions: [
         elbv2.ListenerCondition.hostHeaders([host])  
      ],
      priority: 1000
    })
    
    const zone = route53.HostedZone.fromLookup(this, "zone", {
      domainName: domain,
    })
    
    const record = new route53.ARecord(this, "record", {
      recordName: subdomain,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(alb)
      ),
      zone: zone,
    })
  }
}
