// Re-tags CYSA_QUESTIONS in ../assets/data.js with a fine-grained
// sub-objective (in addition to the existing broad `objective` 1.0-4.0),
// using each question's already-rich free-text `topic` field as the primary
// signal. Informal study-aid taxonomy inspired by the public CompTIA CySA+
// (CS0-003) domain structure; not official CompTIA material.
//
// Run with: node tools/tag-subobjectives.mjs

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, "assets", "data.js");

export const SUB_OBJECTIVES = {
  "1.0": [
    { id: "1.1", label: "Network & System Architecture Security" },
    { id: "1.2", label: "Threat Intelligence & Threat Hunting" },
    { id: "1.3", label: "Malicious Activity & TTP Analysis" },
    { id: "1.4", label: "Endpoint & OS Security" },
    { id: "1.5", label: "Identity & Access Management" },
    { id: "1.6", label: "Encryption & PKI" },
    { id: "1.7", label: "Cloud, Virtualization & Container Security" },
    { id: "1.8", label: "Security Monitoring & Detection Tools" },
    { id: "1.9", label: "Security Orchestration & Automation" },
  ],
  "2.0": [
    { id: "2.1", label: "Vulnerability Scanning Methods & Tools" },
    { id: "2.2", label: "Vulnerability Assessment & Prioritization" },
    { id: "2.3", label: "Penetration Testing Concepts" },
    { id: "2.4", label: "Secure Coding & Web App Vulnerabilities" },
  ],
  "3.0": [
    { id: "3.1", label: "Digital Forensics & Evidence Handling" },
    { id: "3.2", label: "Incident Response Process" },
    { id: "3.3", label: "Business Continuity & Disaster Recovery" },
  ],
  "4.0": [
    { id: "4.1", label: "Risk Management & Communication" },
    { id: "4.2", label: "Data Standards & Compliance Frameworks" },
    { id: "4.3", label: "Governance" },
  ],
};

const RULES = {
  "1.0": [
    ["1.9", /soar/i],
    ["1.2", /^(ti|tg)$|threat hunting|threat intel/i],
    ["1.6", /cryptography|public key infrastructure/i],
    ["1.7", /cloud security|virtualization|container security/i],
    ["1.5", /^authentication|^authorization|^iam /i],
    ["1.4", /os process mgmt|hardening|os\/endpoint hardening/i],
    ["1.3", /^malware|ttps|malicious activity|analyzing malicious activity|process injection|^ddos$|honeypot/i],
    ["1.8", /monitoring|siem|log|syslog|netflow|pcap|edr|ueba|dns monitoring|dlp monitoring|baselin|detection engineering|windows logs|cloud audit logs|web logs|application logs|packet analysis|sysmon/i],
    ["1.1", /network security|network settings|managing network settings|^firewalls|^ids|^ids\/ips|^ids\/ndr/i],
    ["1.1", /.*/],
  ],
  "2.0": [
    ["2.3", /pen testing/i],
    ["2.4", /secure coding/i],
    ["2.1", /vuln scanning|scanning methods/i],
    ["2.2", /vuln mgmt|vulnerability analysis|vulnerability management|vulnerability vs monitoring|vuln validation/i],
    ["2.2", /.*/],
  ],
  "3.0": [
    ["3.1", /forensics|digital forensics/i],
    ["3.3", /^bcp|bcp\/dr|^dr |^dr\(|disaster recovery|bia |backups|resilience|cloud \+ virtualization/i],
    ["3.2", /^ir |incident response|incident workflow|incident vs disaster|malware response/i],
    ["3.2", /.*/],
  ],
  "4.0": [
    ["4.1", /managing risk/i],
    ["4.2", /data standards|compliance/i],
    ["4.3", /governance/i],
    ["4.1", /.*/],
  ],
};

function classify(q) {
  const rules = RULES[q.objective];
  const topic = q.topic || "";
  for (const [id, re] of rules) {
    if (re.test(topic)) return id;
  }
  return rules[rules.length - 1][0];
}

function main() {
  const text = readFileSync(FILE, "utf8");
  const marker = "const CYSA_QUESTIONS = ";
  const start = text.indexOf(marker) + marker.length;
  const end = text.indexOf("\nconst CYSA_OBJECTIVES");
  const arrText = text.slice(start, end).trim().replace(/;\s*$/, "");
  const bank = JSON.parse(arrText);

  const counts = {};
  bank.forEach((q) => {
    q.sub = classify(q);
    counts[q.sub] = (counts[q.sub] || 0) + 1;
  });

  console.log(`Tagged ${bank.length} questions.`);
  for (const [domain, subs] of Object.entries(SUB_OBJECTIVES)) {
    console.log(domain);
    subs.forEach((s) => console.log(`  ${s.id} ${s.label.padEnd(45)} ${counts[s.id] || 0}`));
  }

  const newArrText = JSON.stringify(bank);
  const newText = text.slice(0, start) + newArrText + ";" + text.slice(end);

  const subObjLine = `const CYSA_SUB_OBJECTIVES = ${JSON.stringify(SUB_OBJECTIVES)};\n`;
  const finalText = newText
    .replace(
      'if (typeof module !== "undefined") module.exports = { CYSA_QUESTIONS, CYSA_OBJECTIVES };',
      subObjLine + 'if (typeof module !== "undefined") module.exports = { CYSA_QUESTIONS, CYSA_OBJECTIVES, CYSA_SUB_OBJECTIVES };'
    );

  if (!finalText.includes("CYSA_SUB_OBJECTIVES = {")) {
    throw new Error("Failed to splice CYSA_SUB_OBJECTIVES into data.js — module.exports line not found as expected.");
  }

  writeFileSync(FILE, finalText);
  console.log("\nWrote updated assets/data.js");
}

main();
