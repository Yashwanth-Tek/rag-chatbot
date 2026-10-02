# Test questions for the sample documents

The documents are in the `healthcare`, `finance` and `it` folders. Upload those; this file is only a guide.

## Answered by one document

| Question | Expected answer | Source |
| --- | --- | --- |
| Within how many hours must the discharge summary reach the primary care provider? | 24 hours | riverside-discharge-policy.pdf, page 1 |
| What follow-up does a high-risk patient get after discharge? | A phone call within 48 hours and a clinic visit within 7 days | riverside-discharge-policy.pdf, page 2 |
| What was Oncology's bed occupancy in June 2026? | 92.7% | riverside-department-metrics-q2-2026.csv |
| How much does a telehealth visit cost without insurance? | $49 | riverside-telehealth-faq.md |
| What is the hotel limit in London? | $350 per night | brightwater-expense-policy.docx |
| Who approves an expense claim of $3,200? | The department head | brightwater-expense-policy.docx |
| Which loan has a prepayment penalty? | The Home Equity Line of Credit | brightwater-loan-products.json |
| What was Brightwater's Q2 2026 net interest margin? | 3.21% | brightwater-q2-2026-earnings.txt |
| How fast must a SEV1 incident be acknowledged? | 15 minutes | helix-incident-response-runbook.md |
| What is the minimum password length? | 14 characters | helix-information-security-policy.pdf, page 1 |
| What is the recovery time objective for backups? | 8 hours | helix-service-catalog.json |
| How many rows can a CSV import have in Helix CRM 4.2? | 100,000 (up from 25,000) | helix-crm-4.2-release-notes.docx |

## Needs more than one document

| Question | Expected answer |
| --- | --- |
| Can a low-risk patient have their follow-up by telehealth? | Yes: the policy allows a clinic or telehealth visit within 30 days, and the FAQ confirms it |
| Asset HX-LT-1007 is marked Lost. How quickly should that have been reported? | Within 1 hour, under the security policy (the documents don't say when it was actually reported) |
| Which laptops had their warranty end before June 2026? | HX-LT-1004 and HX-LT-1009 (15 March 2025), and HX-LT-1005 (8 May 2026) |

## Refused on purpose (strict citations)

Every sentence in an answer must carry its own verified citation. An overall conclusion drawn
across several records has no single source to cite, so the answer is rejected and you see
"couldn't find" even though the facts are in the documents.

- Which departments missed the hospital's 30-day readmission target in June 2026? The facts are
  there (Cardiology 12.6% and Oncology 15.3% against a target below 12%), but the conclusion
  "these two missed it" can't be cited.

## Should be refused (not in the documents)

- What is the correct dose of amoxicillin for a child?
- What is Brightwater's share price today?
- Who is the CEO of Helix Systems?
- What is Riverside General Hospital's address?
