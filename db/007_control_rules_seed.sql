-- ============================================================
-- Control mapping rules — SOC 2, GDPR, DPDP
-- Editable: update rows in this table to change mapping logic.
-- One row = one (framework, control_id, finding_type) pair.
-- Multiple rows for the same control_id = ANY match → gap.
-- ============================================================

-- ── SOC 2 Trust Services Criteria ────────────────────────────

INSERT INTO control_rules (framework, control_id, control_name, control_text, finding_type, min_severity) VALUES

('soc2','CC6.1','Logical Access Security',
 'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity''s objectives.',
 'iam_drift','high'),

('soc2','CC6.1','Logical Access Security',
 'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity''s objectives.',
 'secret','medium'),

('soc2','CC6.2','New Access Provisioning',
 'Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users whose access is administered by the entity.',
 'iam_drift','medium'),

('soc2','CC6.3','Access Removal',
 'The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on approved and documented requests within a timeframe commensurate with the entity''s commitments and system requirements.',
 'iam_drift','medium'),

('soc2','CC6.3','Access Removal',
 'The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on approved and documented requests within a timeframe commensurate with the entity''s commitments and system requirements.',
 'public_bucket','high'),

('soc2','CC6.6','Logical Access from Outside',
 'Logical access security measures to protect against threats from sources outside its system boundaries are implemented to prevent unauthorized access.',
 'public_bucket','medium'),

('soc2','CC6.6','Logical Access from Outside',
 'Logical access security measures to protect against threats from sources outside its system boundaries are implemented to prevent unauthorized access.',
 'misconfig','high'),

('soc2','CC7.1','Vulnerability Detection',
 'To meet its objectives, the entity uses detection and monitoring procedures to identify (1) changes to configurations that result in the introduction of new vulnerabilities, and (2) susceptibilities to newly discovered vulnerabilities.',
 'cve','medium'),

('soc2','CC7.1','Vulnerability Detection',
 'To meet its objectives, the entity uses detection and monitoring procedures to identify changes to configurations that result in the introduction of new vulnerabilities.',
 'misconfig','medium'),

('soc2','CC7.2','System Monitoring',
 'The entity monitors system components and the operation of those components for anomalies that are indicative of malicious acts, natural disasters, and errors affecting the entity''s ability to meet its objectives.',
 'misconfig','low'),

('soc2','CC8.1','Change Management',
 'The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its change management commitments.',
 'cve','high'),

-- ── GDPR ─────────────────────────────────────────────────────

('gdpr','Art.5','Principles of Processing',
 'Personal data shall be processed in a manner that ensures appropriate security of the personal data, including protection against unauthorised or unlawful processing and against accidental loss, destruction or damage, using appropriate technical or organisational measures (integrity and confidentiality).',
 'secret','medium'),

('gdpr','Art.5','Principles of Processing',
 'Personal data shall be processed in a manner that ensures appropriate security of the personal data, including protection against unauthorised or unlawful processing and against accidental loss, destruction or damage.',
 'public_bucket','high'),

('gdpr','Art.25','Data Protection by Design',
 'The controller shall implement appropriate technical and organisational measures for ensuring that, by default, only personal data which are necessary for each specific purpose of the processing are processed. In particular, such measures shall ensure that by default personal data are not made accessible without the individual''s intervention to an indefinite number of natural persons.',
 'public_bucket','medium'),

('gdpr','Art.25','Data Protection by Design',
 'The controller shall implement appropriate technical and organisational measures for ensuring that, by default, only personal data which are necessary for each specific purpose of the processing are processed.',
 'iam_drift','medium'),

('gdpr','Art.32','Security of Processing',
 'The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including (a) the pseudonymisation and encryption of personal data; (b) the ability to ensure the ongoing confidentiality, integrity, availability and resilience of processing systems and services.',
 'cve','medium'),

('gdpr','Art.32','Security of Processing',
 'The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.',
 'misconfig','medium'),

('gdpr','Art.32','Security of Processing',
 'The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.',
 'secret','low'),

('gdpr','Art.32','Security of Processing',
 'The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.',
 'iam_drift','medium'),

-- ── DPDP (India Digital Personal Data Protection Act 2023) ───

('dpdp','Sec.8(5)','Data Protection Measures',
 'Every Data Fiduciary shall protect personal data in its possession or under its control by taking reasonable security safeguards to prevent personal data breach.',
 'cve','medium'),

('dpdp','Sec.8(5)','Data Protection Measures',
 'Every Data Fiduciary shall protect personal data in its possession or under its control by taking reasonable security safeguards to prevent personal data breach.',
 'secret','low'),

('dpdp','Sec.8(5)','Data Protection Measures',
 'Every Data Fiduciary shall protect personal data in its possession or under its control by taking reasonable security safeguards to prevent personal data breach.',
 'misconfig','medium'),

('dpdp','Sec.8(5)','Data Protection Measures',
 'Every Data Fiduciary shall protect personal data in its possession or under its control by taking reasonable security safeguards to prevent personal data breach.',
 'public_bucket','high'),

('dpdp','Sec.8(5)','Data Protection Measures',
 'Every Data Fiduciary shall protect personal data in its possession or under its control by taking reasonable security safeguards to prevent personal data breach.',
 'iam_drift','medium'),

('dpdp','Sec.9(1)','Processing of Children''s Data',
 'A Data Fiduciary shall not undertake processing of personal data of a child in a manner that is detrimental to the best interests of the child, and shall not undertake tracking or behavioural monitoring of children or targeted advertising directed at children.',
 NULL, NULL);  -- N/A for infrastructure findings; tracked as met by default
