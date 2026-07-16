import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const CF_TEMPLATE = (externalId: string) => `
AWSTemplateFormatVersion: "2010-09-09"
Description: Sentinel8 read-only scanner role

Parameters:
  Sentinel8AccountId:
    Type: String
    Default: "${process.env.AWS_ACCOUNT_ID}"
    Description: Sentinel8's AWS account ID (do not change)

Resources:
  Sentinel8ScannerRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: Sentinel8ScannerRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS: !Sub "arn:aws:iam::\${Sentinel8AccountId}:root"
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: "${externalId}"
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/SecurityAudit
        - arn:aws:iam::aws:policy/AWSConfigReadOnlyAccess
      MaxSessionDuration: 3600

Outputs:
  RoleArn:
    Value: !GetAtt Sentinel8ScannerRole.Arn
    Description: Paste this ARN into Sentinel8 to complete setup
`.trim();

// POST body: { roleArn: string, scope: string }
// scope = comma-separated "accountId:region" pairs, e.g. "123456789012:us-east-1"
export async function POST(req: NextRequest) {
  const tenantId = process.env.CENTR8_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "CENTR8_TENANT_ID not set" }, { status: 500 });

  const { roleArn, scope } = await req.json() as { roleArn: string; scope: string };
  if (!roleArn || !scope) {
    return NextResponse.json({ error: "roleArn and scope required" }, { status: 400 });
  }

  const { rows } = await pool.query(
    `INSERT INTO connectors (tenant_id, provider, scope, read_only, credential_ref)
     VALUES ($1, 'aws', $2, true, $3)
     RETURNING id`,
    [tenantId, scope, roleArn]
  );
  const connectorId = rows[0].id as string;

  await pool.query(
    `INSERT INTO connector_events (connector_id, tenant_id, actor, event_type, metadata)
     VALUES ($1, $2, 'system', 'installed', $3)`,
    [connectorId, tenantId, JSON.stringify({ role_arn: roleArn, scope })]
  );

  return NextResponse.json({ connectorId });
}

// GET returns the CloudFormation template the customer deploys
export async function GET() {
  // external_id ties the trust policy to this Sentinel8 instance (prevents confused-deputy)
  const externalId = process.env.SENTINEL8_EXTERNAL_ID ?? "sentinel8-dogfood";
  return new Response(CF_TEMPLATE(externalId), {
    headers: { "Content-Type": "text/yaml" },
  });
}
