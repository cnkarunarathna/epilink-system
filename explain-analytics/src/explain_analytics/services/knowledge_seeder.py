"""Dengue knowledge base seeder for the Qdrant RAG corpus.

Seeds the vector store with authoritative dengue documents covering:
- WHO/CDC clinical and prevention guidelines
- Sri Lanka MoH epidemiology and protocols
- Vector control and environmental management
- Clinical management and warning signs
- Outbreak response and surveillance
"""

from explain_analytics.models import RagIngestDocument

# ---------------------------------------------------------------------------
# Knowledge documents: each covers a distinct topic area for broad retrieval
# ---------------------------------------------------------------------------

DENGUE_KNOWLEDGE_DOCUMENTS: list[RagIngestDocument] = [
    # ── 1. Dengue Biology and Transmission ──────────────────────────────────
    RagIngestDocument(
        title="Dengue Fever: Disease Biology and Transmission Dynamics",
        source="WHO Global Dengue Programme",
        published_date="2024-01-15",
        content="""\
Dengue fever is a mosquito-borne viral infection caused by any of four dengue virus serotypes
(DENV-1, DENV-2, DENV-3, DENV-4), belonging to the genus Flavivirus. The primary vector is
Aedes aegypti, a highly domesticated mosquito that breeds in clean, stagnant water containers
near human habitation. Aedes albopictus serves as a secondary vector in some regions.

Transmission cycle: An Aedes mosquito becomes infected when it bites a dengue-viraemic person
during the 4–5 day peak viraemia period. The virus undergoes an extrinsic incubation period
(EIP) of 8–12 days in the mosquito at 28–32 °C. Once infected, the mosquito remains infective
for its entire life (2–4 weeks under field conditions). Human incubation period is 4–10 days
(range 3–14 days) after infective bite.

Risk amplifiers:
- Temperature above 28 °C shortens the EIP and increases mosquito biting frequency (2–3×).
- Rainfall above 80 mm/7 days creates standing water in outdoor containers, flower pots,
  discarded tyres, roof gutters, tree holes, and artificial containers.
- High population density accelerates human-to-mosquito-to-human transmission chains.
- Poor sanitation and water storage practices (uncovered drums, tanks) sustain breeding.
- Urbanisation creates micro-habitats: construction sites, blocked drains, rooftops with
  water accumulation are primary high-risk sites in cities.

Secondary infection risk: Infection with one serotype provides lifelong immunity against that
serotype but only partial cross-protection against others. A second infection with a different
serotype dramatically increases the risk of severe dengue (dengue haemorrhagic fever/dengue
shock syndrome) through antibody-dependent enhancement (ADE) mechanism.

Global burden: Approximately 400 million dengue infections occur annually; 100 million cause
clinical illness; 22,000 result in death. Case fatality rate is <1% with good clinical care
but rises to 20% without treatment.
""",
    ),

    # ── 2. Clinical Presentation – Dengue Fever ────────────────────────────
    RagIngestDocument(
        title="Clinical Presentation and Phases of Dengue Fever",
        source="WHO Dengue Clinical Guidelines 2024",
        published_date="2024-03-01",
        content="""\
Dengue illness progresses through three distinct clinical phases: febrile, critical, and
recovery. Clinicians must distinguish dengue fever (DF) from severe dengue to guide
appropriate triage and management.

Phase 1 — Febrile (Days 1–3):
- Sudden onset high fever (38.5–40 °C), often with facial flushing, skin erythema.
- Severe headache (retro-orbital pain), myalgia, arthralgia ("breakbone fever").
- Nausea, vomiting, and loss of appetite are common.
- Early rash: maculopapular or macular, blanching, may appear on trunk and extremities.
- Positive tourniquet test (≥20 petechiae per 2.5 cm²) indicates capillary fragility.
- Leukopenia (WBC <5,000 cells/mm³) and rising haematocrit are early markers.

Phase 2 — Critical (Days 4–6, typically coincides with defervescence):
- Plasma leakage: haematocrit rise ≥20% above baseline, ascites, pleural effusion,
  pericardial effusion.
- Dengue warning signs (see below) appear just before or during this phase.
- Risk of dengue shock syndrome (DSS): rapid pulse, hypotension, cold extremities.
- Thrombocytopenia nadir (platelet count <100,000 cells/mm³ or dropping rapidly).

Phase 3 — Recovery (Days 7–10):
- Reabsorption of leaked fluids; risk of fluid overload in over-hydrated patients.
- Bradycardia is common.
- Characteristic "isles of white in a sea of red" convalescent rash.
- Haematocrit and platelet counts return to normal.

Dengue Warning Signs (any one warrants hospitalisation):
1. Abdominal pain or tenderness (severe)
2. Persistent vomiting (≥3 episodes/hour for >3 hours)
3. Clinical fluid accumulation (ascites, pleural effusion, pericardial effusion)
4. Mucosal bleeding (epistaxis, gum bleeding, haematemesis, melaena)
5. Lethargy or restlessness / irritability
6. Liver enlargement >2 cm
7. Lab: haematocrit rising + rapid platelet decline

Severe dengue: any one of severe plasma leakage leading to shock, severe bleeding (clinical),
severe organ impairment (liver ALT/AST ≥1,000 IU/L; CNS, renal, cardiac involvement).
""",
    ),

    # ── 3. Dengue Diagnosis ─────────────────────────────────────────────────
    RagIngestDocument(
        title="Laboratory Diagnosis of Dengue: NS1, PCR, and Serology",
        source="WHO Dengue Diagnostic Guidelines",
        published_date="2023-11-01",
        content="""\
Laboratory confirmation of dengue is essential for surveillance, outbreak detection,
and clinical management. The diagnostic approach varies by phase of illness.

Acute phase (Days 1–5):
- NS1 antigen detection: rapid test; positive from day 1; sensitivity 75–90% for primary
  infection, lower (60–70%) for secondary; specificity >99%. Commercially available RDTs
  perform well in resource-limited settings.
- RT-PCR: gold standard for early diagnosis; highly sensitive (>95%) and serotype-specific;
  available from day 1–5; requires trained laboratory.
- Virus isolation: research standard; not used clinically.

Convalescent phase (Days 5+):
- IgM/IgG serology: ELISA-based. IgM appears day 3–5 and peaks weeks 2–4.
  Positive IgM + negative IgG = probable primary infection.
  Positive IgM + positive IgG = probable secondary infection (higher ADE risk).
- Rapid Diagnostic Test (RDT) NS1 + IgM/IgG combo: single-test approach for clinics.

Full blood count interpretation:
- WBC <5,000 cells/mm³ with lymphocytosis is typical dengue pattern.
- Platelet trend is more important than absolute value: falling rapidly (>50% in 24h)
  indicates progression; <20,000 cells/mm³ requires monitoring for major bleeding.
- Haematocrit rise ≥20% above baseline = plasma leakage; requires IV fluid management.

Differential diagnoses to exclude: chikungunya, Zika virus, leptospirosis,
malaria (endemic areas), typhoid fever, influenza, measles, rubella.

Surveillance reporting: All confirmed and suspected dengue cases must be notified to the
Regional Director of Health Services within 24 hours under Sri Lanka's Notifiable Disease
Regulations.
""",
    ),

    # ── 4. Dengue Treatment and Clinical Management ─────────────────────────
    RagIngestDocument(
        title="Dengue Treatment Protocol and Fluid Management",
        source="Sri Lanka Ministry of Health Clinical Guidelines",
        published_date="2024-05-01",
        content="""\
There is no specific antiviral treatment for dengue. Management is supportive and directed
at preventing plasma leakage complications and managing bleeding.

Outpatient management (non-severe dengue, no warning signs):
- Encourage oral rehydration: 2.5–3 L/day for adults; ORS, coconut water, fruit juice.
- Paracetamol for fever (15 mg/kg/dose, max 4 doses/day); avoid NSAIDS and aspirin
  (inhibit platelet function, increase bleeding risk).
- Daily or alternate-day full blood count (FBC) to monitor platelet and haematocrit trends.
- Strict home monitoring: return to hospital immediately if warning signs appear.
- Mosquito net or repellent use during febrile period to prevent onward transmission.

Inpatient management — Group B (warning signs or co-morbidities):
- IV crystalloid fluids: Ringer's lactate or 0.9% normal saline.
  Starting rate: 5–7 mL/kg/hour; titrate based on clinical response.
- Monitor urine output hourly (target >0.5 mL/kg/h).
- Haematocrit every 4–6 hours; platelet count every 12 hours.
- If haematocrit rises ≥20%: fluid rate 10 mL/kg/h for 1 hour, then reassess.
- Reduce IV fluids as fever defervesces to prevent fluid overload in recovery phase.

Inpatient management — Group C (severe dengue / shock):
- Dengue shock syndrome: bolus 10–20 mL/kg of crystalloid over 15–30 minutes.
  Reassess: if improving → taper to 5–10 mL/kg/h; if deteriorating → colloid or blood.
- Platelet transfusion: only for active severe bleeding or platelet <10,000 cells/mm³
  with clinical bleeding risk; prophylactic transfusion is NOT recommended.
- Fresh frozen plasma for coagulopathy with bleeding.
- ICU admission for haemodynamic instability, refractory shock, severe organ involvement.
- Avoid unnecessary procedures: no IM injections during thrombocytopenic phase.

Hospital bed management during outbreaks:
- Reserve HDU/ICU beds for Group C patients.
- Establish dedicated dengue wards with IV fluid monitoring capacity.
- Nurse-to-patient ratio of at least 1:4 for Group B patients during critical phase.
""",
    ),

    # ── 5. Vector Control – Larval Source Reduction ─────────────────────────
    RagIngestDocument(
        title="Aedes Larval Source Reduction: Primary Vector Control Strategy",
        source="WHO Vector Control Guidelines for Dengue",
        published_date="2023-08-01",
        content="""\
Larval source reduction (LSR) is the most cost-effective and sustainable dengue vector
control strategy. It targets Aedes aegypti at the larval stage by eliminating or treating
water-holding containers before adult mosquitoes emerge.

Container surveillance and classification:
- High-risk containers: water storage drums/tanks (uncovered), flower pot trays, bird baths,
  roof gutters, discarded tyres, construction waste with pooled water, tree holes.
- Container indices used for monitoring: Breteau Index (BI), House Index (HI), Container
  Index (CI). BI >5 is considered epidemic threshold in many settings.
- Larval survey teams should cover ≥50 houses per MOH area per week during peak season.

Physical control methods:
- Empty, scrub, and invert small containers (flower pots, pet water dishes) weekly.
- Cover water storage containers with tightly fitting lids; use fine mesh for overflow holes.
- Remove tyres, leaf litter, and debris that collect rainwater.
- Fill tree holes and rock pools with sand or cement.
- Replace water in flower vase arrangements weekly; add sand to cut-flower vases.
- Clear roof gutters of leaf debris monthly; ensure proper drainage slope.

Chemical larval control (larviciding):
- Temephos (Abate) 1% sand granules: 1 g/10 litres; safe for drinking water containers.
- Bacillus thuringiensis israelensis (Bti): biological larvicide; apply to ornamental ponds,
  roof tanks; re-apply every 4–8 weeks or after heavy rain.
- Insect growth regulators (IGRs): pyriproxyfen; prevents adult emergence; used in large
  water storage systems that cannot be drained.

Community engagement for LSR:
- Weekly "search and destroy" community campaigns reduce HI by 40–60%.
- School-based programmes engage children as vector control agents within households.
- Reporting of neighbours' breeding sites to Public Health Inspectors (PHIs) is encouraged.
- Intersectoral action: construction companies required to maintain weekly larval surveys
  on sites; penalties for non-compliance under Public Health Ordinance.
""",
    ),

    # ── 6. Chemical Vector Control – Fogging and Spraying ──────────────────
    RagIngestDocument(
        title="Adult Mosquito Control: Thermal Fogging and ULV Spraying",
        source="Sri Lanka Anti-Malaria Campaign / NMCP Vector Control SOP",
        published_date="2024-02-01",
        content="""\
Adult mosquito control through thermal fogging (hot-fog) or ultra-low-volume (ULV) cold
misting is a rapid-response tool used to suppress Aedes aegypti adult populations during
dengue outbreaks. It is supplementary to LSR and should not replace source reduction.

Indication for fogging:
- Confirmed dengue cluster: ≥2 laboratory-confirmed cases within 200 m radius.
- Rapid WoW case surge ≥30% in a MOH area.
- Weekly district case count ≥100 with rising trajectory.
- MOH area Breteau Index ≥10 during active transmission.

Insecticides approved for dengue fogging in Sri Lanka:
- Pyrethroid group: deltamethrin 0.5%, lambda-cyhalothrin 0.5%, cypermethrin 2%.
- Malathion 96% EC: organophosphate; effective but phased out in favour of pyrethroids.
- Resistance monitoring: sentinel sites across 5 provinces tested bi-annually for
  knockdown resistance (kdr) mutations; alternative insecticide deployed if resistance >50%.

Fogging protocol:
- Optimal timing: 06:00–08:00 and 17:00–19:00 when Aedes aegypti activity peaks.
- Vehicle-mounted thermal fogger: treat both sides of roads; speed 5–8 km/h.
- Coverage radius: 50–100 m from road; target houses, gardens, peridomestic areas.
- Residents advised to remain indoors during fogging; pets and fish ponds covered.
- Minimum 3 consecutive rounds at 3–5 day intervals for sustained adult suppression.
- Post-fogging entomological assessment after round 3 to evaluate efficacy.

Environmental and safety precautions:
- Avoid fogging near water bodies, apiaries (bee colonies), vegetable gardens within 30 m.
- Personnel wear PPE: respirator, goggles, nitrile gloves, coveralls.
- Wind speed <10 km/h for effective droplet deposition; do not fog in rain.
- Document insecticide batch number, coverage area, and date for resistance monitoring.

Limitations of fogging:
- Contact killing only; does not affect larvae or pupae.
- Aerosol droplets (10–15 µm) must contact resting or flying adult mosquitoes.
- Aedes aegypti rests indoors; vehicle-mounted outdoor fogging has limited indoor efficacy.
- Space spraying reduces adult density for 3–5 days without concurrent LSR.
""",
    ),

    # ── 7. Sri Lanka Dengue Epidemiology ────────────────────────────────────
    RagIngestDocument(
        title="Dengue Epidemiology in Sri Lanka: Seasonal Patterns and High-Risk Districts",
        source="Sri Lanka Epidemiology Unit, Ministry of Health",
        published_date="2024-06-01",
        content="""\
Sri Lanka reports among the highest dengue burdens in South Asia, with annual case counts
ranging from 20,000 to over 180,000 in epidemic years (2017 peak: 187,000 cases, 340 deaths).

Seasonal transmission patterns:
- Southwest monsoon (May–September): primary peak affecting western, southern, and central
  provinces (Colombo, Gampaha, Kalutara, Kandy, Ratnapura, Galle, Matara).
- Northeast monsoon (October–January): secondary peak affecting northern and eastern
  provinces (Jaffna, Kilinochchi, Mannar, Vavuniya, Trincomalee, Batticaloa, Ampara).
- Inter-epidemic trough: February–April (historically lowest case counts).
- Bi-annual peak pattern with SW monsoon peak consistently 2–3× larger than NE peak.

High-burden districts (5-year average cases per year):
1. Colombo: 8,000–20,000 (largest population, highest urban density)
2. Gampaha: 6,000–14,000 (rapid peri-urban expansion)
3. Kandy: 3,000–8,000 (highland city; year-round transmission)
4. Kalutara: 2,500–6,000 (coastal; high rainfall)
5. Kurunegala: 2,000–5,000 (provincial centre)
6. Ratnapura: 2,000–4,500 (rubber plantation zone; high rainfall)
7. Galle: 1,500–4,000 (southern coastal city)
8. Matara: 1,200–3,000 (adjacent to Galle; similar pattern)
9. Puttalam: 1,000–3,000 (dry zone; brackish water lagoons)
10. Anuradhapura: 800–2,000 (historic city; irrigation canals)

Serotype circulation (2019–2024):
- All four serotypes (DENV-1 to DENV-4) circulate simultaneously.
- DENV-2 and DENV-3 dominant in most recent years (2022–2024).
- Serotype shift (e.g., return of DENV-3 after decade gap) is associated with epidemic years
  because large susceptible cohorts lack serotype-specific immunity.

Demographic risk factors:
- Highest incidence in 5–14 year age group (school-age children); accounts for 35–40%
  of hospitalised cases.
- Young adults (15–30) have highest absolute case numbers due to exposure frequency.
- School term reopening (January, April, September) correlates with early outbreak signals.

Alert thresholds used by Sri Lanka Epidemiology Unit:
- Early warning: WoW case increase ≥15% OR weekly cases ≥1.5× 4-week average.
- Outbreak alert: weekly cases ≥2× 4-week average in any MOH area.
- Emergency: district weekly cases ≥100 with rising trajectory; activate Provincial Director.
""",
    ),

    # ── 8. Outbreak Response Protocol ──────────────────────────────────────
    RagIngestDocument(
        title="Dengue Outbreak Response Protocol: Sri Lanka MoH",
        source="Sri Lanka Ministry of Health Epidemiology Unit",
        published_date="2024-04-01",
        content="""\
Dengue outbreak response in Sri Lanka follows a tiered alert system coordinated by
the Epidemiology Unit under the Director General of Health Services (DGHS).

Tier 1 — MOH Area Response (early warning level):
Trigger: WoW case increase ≥15% OR BI ≥5 in any MOH area.
Actions:
- PHI team conducts immediate larval survey and source reduction within 200 m of cases.
- Medical Officer of Health (MOH) activates community source-reduction campaign.
- Schools and offices in cluster zone receive education notices.
- Active case finding: fever clinics in high-incidence GN divisions.
- Increase reporting frequency from weekly to daily during active cluster.

Tier 2 — District Response (outbreak alert):
Trigger: Weekly cases ≥2× 4-week average; any confirmed cluster of ≥5 cases in 50 m radius.
Actions:
- Regional Epidemiologist notified; District Secretary Health informed.
- Vector control team deployed for thermal fogging (3 rounds, 3-day intervals).
- Hospital preparedness activated: dedicated dengue ward, IV fluid stock review.
- Media communication: local radio/TV health advisories, social media alerts.
- Daily case tracking dashboard updated; data shared with Provincial Director.
- Intersectoral coordination: municipal council (drain clearance), water board (tank covers).

Tier 3 — Provincial/National Emergency:
Trigger: District weekly cases ≥100 with rising trend; province-wide simultaneous rise;
         case fatality rate rising above 0.2%.
Actions:
- Provincial Director of Health Services activates EOC.
- National supply release: IV fluids, consumables, insecticides to affected districts.
- Army medical corps and Civil Defense deployed for source reduction mega-campaigns.
- International notification if criteria met under IHR 2005.
- Daily ministerial briefing; MoH daily situation report published.

Post-outbreak review:
- After each major outbreak, district PHI teams conduct structured root cause analysis.
- Review of response timeliness, resource gaps, and case management outcomes.
- Recommendations incorporated into next pre-monsoon preparedness plan.
- Insecticide resistance status evaluated and procurement adjusted accordingly.
""",
    ),

    # ── 9. Community Prevention and Public Education ────────────────────────
    RagIngestDocument(
        title="Community-Level Dengue Prevention: Behaviour Change Communication",
        source="Sri Lanka Health Promotion Bureau",
        published_date="2024-01-01",
        content="""\
Community participation is essential for sustained dengue prevention. Behaviour change
communication (BCC) programmes focus on eliminating breeding sites and recognising warning
signs early.

Key prevention messages for households:
1. Check and empty all water containers weekly (flower pots, pet water dishes, coolers,
   buckets, discarded containers). The 3-minute home inspection covers 90% of breeding sites.
2. Cover all water storage tanks and drums with tightly fitting lids.
3. Change vase water weekly; add sand to pot bases to prevent water accumulation.
4. Clear roof gutters, drainpipes, and AC condensate lines monthly.
5. Apply window and door screens; use mosquito nets for daytime sleeping (Aedes bites
   actively during daylight hours, particularly 06:00–10:00 and 16:00–19:00).
6. Use DEET-based or picaridin repellent when outdoors during peak biting hours.
7. Wear long-sleeved clothing and long trousers in high-risk areas.

Community action campaigns:
- "Dengue-Free Village" competitions: GN divisions compete on lowest BI scores;
  winners recognised by PHI and District Secretariat.
- School dengue brigades: students trained to inspect and report breeding sites at home.
- Buddhist temple and Kovil outreach: religious leaders relay prevention messages to
  congregations; temple premises inspected monthly during high-risk periods.
- SMS alert system: Epidemiology Unit sends district-level outbreak alerts to registered
  subscribers (healthcare workers, school principals, local government officials).

High-risk settings requiring special attention:
- Construction sites: weekly PHI inspection; water accumulation in cement mixers,
  scaffolding hollows, temporary water containers.
- Hospitals: ornamental gardens, AC units, roof tanks must be inspected weekly.
- Hotels and tourist establishments: outdoor decorative features (fountains, bird baths)
  are frequent breeding sites; hospitality sector BCC programme operated by Tourism Board.
- Rubber plantations (Ratnapura, Kalutara, Matara): discarded collection cups (latex
  cups) are major breeding containers; monthly retrieval campaigns.

Aedes aegypti behavioural facts for public education:
- Aedes bites primarily during daylight hours; sleeping under nets only at night is
  insufficient protection.
- Aedes flies only 50–100 m from its breeding site; eliminating nearby containers provides
  effective local protection.
- One breeding container can produce 100–500 adult mosquitoes per week.
""",
    ),

    # ── 10. Pre-Monsoon Preparedness ────────────────────────────────────────
    RagIngestDocument(
        title="Pre-Monsoon Dengue Preparedness Planning",
        source="Sri Lanka Ministry of Health Circular",
        published_date="2024-03-15",
        content="""\
Pre-monsoon preparedness activities are conducted annually in March–April (before SW monsoon)
and September–October (before NE monsoon) to reduce dengue transmission during peak risk periods.

Health system preparedness:
- Hospital bed capacity audit: identify surge capacity (step-down wards, day-care units)
  that can be converted to dengue care; target 20% surge capacity above normal dengue
  admissions.
- Medical supply procurement: IV fluid stocks (RL, NS) for 12-week demand; platelet
  monitoring equipment; NS1 rapid test kits for outpatient departments.
- Training: nursing and medical staff refresher on dengue fluid management protocol;
  triage algorithm training for outpatient staff.
- Laboratory preparedness: agreements with reference laboratories for PCR testing backup
  when outbreak laboratories are overwhelmed.

Vector control readiness:
- Insecticide stock audit: thermal fogger fuel, pyrethroid insecticide stocks for 8-week
  sustained operation; calibration of fogging equipment.
- PHI team briefing: review of previous season's hot spots; update priority MOH area list.
- Vehicle fleet readiness: fogger-mounted vehicles serviced and fuel cards activated.
- Larvicide stock: temephos and Bti for distribution to high-risk households and community
  water storage sites.

Entomological surveillance:
- Pre-monsoon larval survey in all MOH areas: establish baseline BI before rains begin.
- Ovitraps deployed at sentinel sites in 5 priority districts (Colombo, Gampaha, Kandy,
  Kalutara, Kurunegala): weekly egg count trends predict adult population build-up 2 weeks
  ahead.
- Vector surveillance report shared with district MOH teams by Week 14 annually.

Intersectoral coordination:
- Municipal and Urban Councils: drain-clearing schedule before monsoon; penalty notices
  to premises with repeat breeding site violations.
- National Water Supply and Drainage Board: inspection of water towers and distribution
  infrastructure.
- Ministry of Education: school principal circular on pre-monsoon inspection protocols.
- District Secretariat: coordinate with Divisional Secretariats for urban source-reduction
  mega-campaigns.
""",
    ),

    # ── 11. Dengue Surveillance System – Sri Lanka ──────────────────────────
    RagIngestDocument(
        title="Dengue Surveillance System Architecture in Sri Lanka",
        source="Sri Lanka Epidemiology Unit",
        published_date="2024-02-01",
        content="""\
Sri Lanka operates a comprehensive dengue surveillance system integrating passive case
reporting, active sentinel surveillance, and entomological monitoring.

Passive case notification:
- All hospitals (government and private), clinics, and laboratories are required to notify
  dengue cases (confirmed and suspected) to the Regional Director of Health Services (RDHS).
- Notification forms: H544 (immediate notification) within 24 hours of suspicion;
  laboratory confirmation reported separately within 7 days.
- Weekly compilation by RDHS offices; aggregated to national level by Epidemiology Unit.
- Electronic notification via web-based DHIS2 system since 2020; mobile app for PHIs.

Active sentinel surveillance:
- 15 sentinel hospitals nationwide collect demographic data, clinical severity, serotype,
  and outcome for all admitted dengue patients.
- Data includes: age, sex, GN division of residence, disease day at admission,
  platelet nadir, haematocrit peak, LOS, and discharge outcome.
- Monthly sentinel report published on Epidemiology Unit website.

Entomological surveillance:
- Ovitraps (350 ml black containers with wooden paddle) deployed at sentinel sites;
  ovitrap index (OI) correlates with adult female Aedes population density.
- Larval index surveys: BI, HI, CI computed quarterly by PHI teams.
- Adult mosquito collection: BG-Sentinel traps at international airports (Katunayake, Mattala)
  for border surveillance; weekly reporting to WHO SEARO.

Data quality and reporting:
- Under-reporting estimated at 5–10× for outpatient dengue cases; severe/hospitalised
  cases are more completely captured.
- Case definition used: WHO 2009 revised dengue classification (dengue without
  warning signs / with warning signs / severe dengue).
- Epidemiological weeks used for reporting (Monday to Sunday).
- Alert threshold system: computer-generated weekly alert emails sent to district MOH
  when cases exceed moving-average threshold.

EpiLink Decision Support System:
- Machine learning ensemble (XGBoost + LightGBM) produces district-level risk scores
  weekly using 15+ features: case counts, weather data, historical seasonality, SHAP values.
- Risk scores calibrated against 5-year historical data; district-specific baselines.
- Weekly automated report distributed to Provincial Directors, District MOH teams,
  and Ministry Health Information Division.
""",
    ),

    # ── 12. Dengue in Pregnancy ─────────────────────────────────────────────
    RagIngestDocument(
        title="Dengue During Pregnancy: Clinical Management and Risk",
        source="WHO/PAHO Dengue in Pregnancy Guidelines",
        published_date="2023-06-01",
        content="""\
Dengue during pregnancy poses increased risks to both mother and foetus. Pregnant women with
dengue require close monitoring and may need hospitalisation even without classic warning signs.

Maternal risks:
- Severe plasma leakage can occur at lower threshold haematocrit rise (15% vs 20% in
  non-pregnant adults) due to physiological haemodilution of pregnancy.
- Puerperal haemorrhage risk elevated when delivery coincides with thrombocytopenic phase.
- Fluid management is more complex due to changes in intravascular volume.
- Platelet count <50,000/mm³ near delivery requires haematology consultation.

Foetal/neonatal risks:
- Vertical transmission (maternal to foetus/neonate) occurs; neonatal dengue carries
  high severity risk.
- Peripartum maternal dengue (within 2 weeks of delivery): greatest risk of neonatal dengue.
- Intrauterine growth retardation, preterm birth, and foetal loss reported in severe cases.
- Neonates of dengue-viraemic mothers: monitor with FBC for 10 days post-delivery.

Management principles for dengue in pregnancy:
- Hospitalise at lower threshold: any warning sign OR platelet <100,000/mm³ OR any WoW rise
  during outbreak peak.
- Fluid rate adjustment: titrate IV fluids cautiously; avoid fluid overload (pulmonary oedema
  risk is higher with reduced colloid oncotic pressure of pregnancy).
- Paracetamol for fever control; avoid NSAIDs throughout pregnancy.
- Coordinate with obstetrics: dengue ward should have obstetrician consultation available.
- Defer elective procedures (episiotomy, amniocentesis) until platelet count ≥50,000/mm³.
- Breastfeeding: dengue virus transmitted in breast milk is rare; WHO recommends continued
  breastfeeding unless mother critically ill.

Reporting: Maternal dengue must be notified separately to the Family Health Bureau in
addition to standard epidemiological notification, for perinatal outcome monitoring.
""",
    ),

    # ── 13. Dengue and Weather/Climate ─────────────────────────────────────
    RagIngestDocument(
        title="Climate Drivers of Dengue Transmission: Temperature, Rainfall, and Humidity",
        source="WHO Climate Change and Dengue Research Brief",
        published_date="2024-01-01",
        content="""\
Dengue transmission intensity is strongly modulated by meteorological variables. Understanding
climate-dengue relationships is critical for early warning systems and seasonal forecasting.

Temperature effects:
- Optimal Aedes aegypti development: 25–30 °C. Larval development time halves from
  18 days at 22 °C to 8 days at 30 °C.
- Extrinsic incubation period (EIP): 8 days at 32 °C; 14 days at 26 °C; >20 days <20 °C.
- Biting rate: 0.06 bites/day at 20 °C vs 0.22 bites/day at 30 °C (3.7× increase).
- Thermal threshold: Aedes activity essentially ceases below 16 °C (highland districts
  above 1,500 m have lower transmission).
- Urban heat island effect: cities 2–4 °C warmer than surrounding areas → longer
  transmission season and faster EIP in urban cores.

Rainfall effects:
- Moderate rainfall (20–80 mm/week): fills breeding containers; peak larval density
  observed 2–3 weeks after moderate rainfall events.
- Heavy rainfall (>100 mm in 48h): may flush larvae from containers (temporary reduction)
  followed by rebound as new standing water accumulates.
- Drought preceding outbreak: water storage behaviour (uncovered drums) increases during
  water shortages, creating concentrated breeding sites in peridomestic settings.
- Cumulative 7-day rainfall >80 mm is the standard threshold for elevated vector alert
  in Sri Lanka Epidemiology Unit early warning system.

Humidity effects:
- Relative humidity >60%: extends adult mosquito survival (lifespan increases from 2 weeks
  at 50% RH to 3+ weeks at 80% RH), increasing probability of EIP completion.
- High humidity days correlate with greater Aedes flight activity and feeding frequency.

El Niño / La Niña effects:
- El Niño years (reduced rainfall): paradoxically increase dengue in dry-zone districts
  due to water storage behaviour. Wet-zone districts may see reduced transmission.
- La Niña years (increased rainfall): associated with epidemic-year dengue in Sri Lanka
  (2016–2017 La Niña preceded 2017 record epidemic).

Climate change projection:
- Temperature increase of 1–2 °C projected for Sri Lanka by 2050 will extend dengue
  transmission season by 2–4 weeks per year.
- Changing monsoon patterns will alter timing but not magnitude of seasonal peaks.
- Highlands (>1,200 m elevation) becoming dengue-endemic in new areas (Nuwara Eliya,
  Badulla) as temperatures rise.
""",
    ),

    # ── 14. Dengue Vaccine – Dengvaxia ─────────────────────────────────────
    RagIngestDocument(
        title="Dengue Vaccination: Dengvaxia and CYD-TDV Current Evidence",
        source="WHO Position Paper on Dengue Vaccines",
        published_date="2024-05-01",
        content="""\
Dengvaxia (CYD-TDV, Sanofi Pasteur) is the first licensed dengue vaccine, approved in
several countries for restricted use. A second vaccine (TAK-003, Takeda) is now also
licensed and offers broader applicability.

Dengvaxia (CYD-TDV):
- Tetravalent live attenuated chimeric dengue/yellow fever vaccine; 3-dose schedule.
- Recommended only for seropositive individuals aged 9–45 years living in high-endemic areas.
- Efficacy: 65.6% against confirmed dengue; 92.9% against severe dengue in seropositive.
- Critical limitation: vaccine increases risk of severe dengue in SERONEGATIVE individuals
  (those not previously infected). Pre-vaccination serology screening is mandatory.
- WHO recommendation: screen-and-vaccinate strategy only.
- Not approved for use in Sri Lanka as of 2024; serology screening infrastructure constraints.

TAK-003 (Qdenga, Takeda):
- Tetravalent live attenuated dengue vaccine; 2-dose schedule (0 and 3 months).
- Approved in EU, Indonesia, Brazil, Argentina (2022–2023); WHO prequalified 2024.
- Efficacy: 80.2% against symptomatic dengue, 90.4% against hospitalisation (seropositive);
  54.3% efficacy in seronegative individuals (no increased risk demonstrated).
- Suitable for broader use without mandatory pre-screening in high-burden settings.
- Currently under review by Sri Lanka National Medicines Regulatory Authority (NMRA).

WHO global recommendation (2024):
- Where affordable, TAK-003 may be introduced into national immunisation programmes for
  children 6–16 years in high-transmission settings (dengue seroprevalence >70% in target age).
- Must complement, not replace, integrated vector management and clinical case management.
- Surveillance data is critical for monitoring vaccine effectiveness post-introduction.

Sri Lanka current position:
- No dengue vaccine included in National Immunisation Programme as of 2024.
- Research trials planned for evaluation of TAK-003 in school-age children.
- The primary prevention strategy remains larval source reduction, community education,
  and outbreak-responsive vector control.
""",
    ),

    # ── 15. Severe Dengue / DHF / DSS ──────────────────────────────────────
    RagIngestDocument(
        title="Dengue Haemorrhagic Fever and Dengue Shock Syndrome: Pathophysiology and Management",
        source="WHO Dengue Guidelines for Diagnosis, Treatment, Prevention and Control",
        published_date="2023-09-01",
        content="""\
Dengue haemorrhagic fever (DHF) and dengue shock syndrome (DSS) represent the severe end
of the dengue clinical spectrum. Prompt recognition and fluid resuscitation are life-saving.

Pathophysiology of DHF:
- Enhanced immune response in secondary dengue infection triggers cytokine storm (TNF-α,
  IL-6, IL-10), endothelial activation, and increased vascular permeability.
- Antibody-dependent enhancement (ADE): heterologous antibodies from primary infection
  facilitate viral entry into Fc receptor-bearing cells (monocytes, macrophages),
  amplifying viraemia and immune activation.
- Platelet destruction: viral antigen binding + cross-reactive antibodies + complement
  activation → thrombocytopenia; impaired function + platelet destruction.
- Haemoconcentration: ≥20% rise in haematocrit indicates plasma leak of ≥20% of
  intravascular volume into third space.

WHO DHF criteria (all 4 required):
1. Fever lasting 2–7 days
2. Any haemorrhagic manifestation (positive tourniquet test, petechiae, ecchymosis,
   epistaxis, gum bleeding, haematemesis, or positive faecal occult blood)
3. Thrombocytopenia (platelet count ≤100,000/mm³)
4. Haemoconcentration (≥20% rise in haematocrit) or evidence of plasma leakage

DSS: DHF criteria + evidence of circulatory failure (narrow pulse pressure ≤20 mmHg
or hypotension + cold clammy skin + restlessness).

Management of DSS:
- Establish IV access immediately; draw samples for FBC, haematocrit, LFT, renal function.
- Volume expansion: Ringer's lactate 10–20 mL/kg over 15–30 min.
- Reassess after each bolus: if improving → 10 mL/kg/h; if no improvement → colloid
  (dextran or gelatin) 10–20 mL/kg; if haematocrit rising with shock → packed RBC.
- Monitoring frequency: vital signs every 15–30 minutes; haematocrit every 2 hours in shock.
- Avoid excessive fluids: over-hydration causes pulmonary oedema, respiratory distress.
- Platelet transfusion: only for severe bleeding or prophylactically if <10,000/mm³.
- ICU level monitoring essential for DSS; high mortality without skilled nursing care.

Case fatality rate: <0.5% with optimal management vs 10–20% untreated.
""",
    ),

    # ── 16. Integrated Vector Management ───────────────────────────────────
    RagIngestDocument(
        title="Integrated Vector Management for Dengue: Multi-Component Approach",
        source="WHO Integrated Vector Management Framework",
        published_date="2023-07-01",
        content="""\
Integrated Vector Management (IVM) is the WHO-recommended approach combining multiple
vector control methods to maximise public health impact while optimising resource use.

Core IVM components for dengue:
1. Larval source reduction (LSR): Environmental management to eliminate breeding sites.
   Effectiveness: reduces BI by 60–80% in community trials; most cost-effective long-term.

2. Biological control: Bacillus thuringiensis israelensis (Bti) and Bacillus sphaericus
   target larvae in large water bodies. Copepods (Mesocyclops spp.) effective in cisterns.
   Wolbachia-infected mosquitoes: releases of wMel-Wolbachia Aedes reduce transmission
   by 40–75% in randomised controlled trials (Yogyakarta, Indonesia 2019).

3. Chemical control: Larviciding (temephos, pyriproxyfen) and adulticiding (thermal
   fogging, ULV spraying). Use guided by vector density thresholds and outbreak alerts.
   Resistance management essential: rotate insecticide classes between seasons.

4. Personal protection: DEET repellents, permethrin-treated clothing, bed nets, window
   screens. Complements community-level source reduction.

5. Genetic approaches (emerging): Sterile Insect Technique (SIT) releases of irradiated
   male Aedes; OX513A genetically modified mosquito releases (self-limiting strain).
   Field trials ongoing in Sri Lanka (Peliyagoda, 2023).

6. Community engagement: Intersectoral collaboration between Health, Education, Local
   Government, and private sector is essential for sustained vector control.

Resource allocation framework:
- Year-round baseline: LSR community campaigns + PHI larval surveillance (all districts).
- Pre-monsoon surge: larviciding high-BI areas + PHI intensive surveys (priority districts).
- During outbreak: LSR + thermal fogging (confirmed clusters) + active case finding.
- Post-outbreak: entomological assessment + insecticide resistance testing + review.

Evidence for IVM effectiveness:
- Combined LSR + community engagement: 40–60% case reduction (RCTs, 3 countries).
- Adding biological control (Bti): incremental 15–20% reduction on top of LSR.
- Adding fogging without LSR: 30–40% short-term adult reduction; effect lasts 3–7 days.
- Wolbachia deployment: 77% reduction in dengue incidence in Yogyakarta trial (2019).
""",
    ),

    # ── 17. Dengue and Children ─────────────────────────────────────────────
    RagIngestDocument(
        title="Dengue Fever in Children: Paediatric Considerations",
        source="Paediatric Society of Sri Lanka Dengue Guidelines",
        published_date="2024-01-01",
        content="""\
Children account for 35–40% of dengue hospitalisations in Sri Lanka. Paediatric dengue
has clinical differences from adult presentation that clinicians must recognise.

Clinical features in children:
- Febrile seizures occur in 5–10% of children under 5 with dengue-related high fever.
- Younger children (under 5): fever may be the only presenting symptom; classic
  headache/arthralgia often absent or unrecognised.
- Rapid dehydration from fever + vomiting + reduced intake occurs more quickly in children.
- Fluid management: smaller absolute volumes required; weight-based calculations critical.
- Children are at higher risk of rapid progression to dengue shock during the critical phase.
- Haematocrit: normal ranges differ by age and sex (boys: Hct 42±5%; girls: 40±5%);
  must compare to child's own baseline, not adult reference ranges.
- Rash is more prominent and easier to detect in children with lighter skin; tourniquet
  test interpretation same as adults (≥20 petechiae = positive).

Warning signs in children requiring hospitalisation:
- Any warning sign as per adult criteria, PLUS:
- Refusal to feed / drink for >4 hours
- Decreased urine output (no wet nappy for >4 hours in infants)
- Inconsolable crying or excessive drowsiness in infants
- Abdominal distension (ascites difficult to detect clinically in toddlers)

Fluid management for children:
- Maintenance: calculate using Holiday-Segar formula; add deficit correction for
  dehydration.
- Group B (warning signs): 5–7 mL/kg/h; reduce to 3–5 mL/kg/h after clinical improvement.
- Group C (shock): 10–20 mL/kg bolus; reassess; repeat up to 3 times; use colloid if
  haematocrit not improving after 2nd bolus.

School management during outbreak:
- Daily temperature screening recommended during active school-level outbreak.
- Absence policy: febrile children should be excluded from school for minimum 5 days +
  afebrile 24 hours; reduces classroom transmission.
- School Medical Officer notified immediately for confirmed cases to facilitate rapid
  entomological survey of school premises.
""",
    ),

    # ── 18. Dengue Rapid Test Interpretation ────────────────────────────────
    RagIngestDocument(
        title="Field Use of Dengue Rapid Diagnostic Tests: NS1 and IgM/IgG",
        source="WHO Regional Office for South-East Asia",
        published_date="2023-04-01",
        content="""\
Dengue rapid diagnostic tests (RDTs) enable point-of-care diagnosis in resource-limited
settings. Understanding test performance is essential for accurate interpretation.

NS1 Antigen RDT:
- Detects dengue NS1 protein in serum/plasma; commercially available (Panbio, SD Bioline,
  Dengue NS1 Ag STRIP, etc.).
- Performance: sensitivity 75–90% (days 1–5); specificity >99%.
- Primary infection: higher sensitivity (up to 95%) due to higher viraemia and NS1 levels.
- Secondary infection: sensitivity lower (55–70%) due to immune complex formation reducing
  free NS1 detectable in serum; do not rule out dengue on negative NS1 alone.
- Interpretation: positive NS1 in febrile patient from endemic area = very high probability
  of dengue (positive predictive value >98% during outbreak season).
- NS1 can remain positive until day 9; test is less useful after fever defervescence.

IgM/IgG Combo RDT:
- Detects dengue-specific IgM and IgG antibodies; useful from day 4–5 onwards.
- Primary infection pattern: IgM positive, IgG negative (or low). Appears day 3–5,
  peaks day 14–21; remains positive 2–3 months.
- Secondary infection pattern: IgG positive, IgM variable (may be weakly positive or
  negative). IgG rises rapidly (day 2–3) due to anamnestic response.
- Equivocal patterns: both IgM and IgG weak positive or both negative; requires
  confirmation by ELISA or RT-PCR.

Combined NS1 + IgM/IgG strategy:
- Days 1–5: NS1 antigen RDT. If negative but clinical suspicion high → confirm with PCR.
- Days 5+: IgM/IgG RDT. If NS1 negative and IgM positive → likely dengue.
- Both negative with strong clinical suspicion: repeat testing 24–48 hours later or
  send serum for ELISA/RT-PCR to reference laboratory.

False positives:
- NS1: cross-reactivity with flaviviruses (Zika, West Nile) reported in some RDT brands
  but rare in Sri Lanka context.
- IgM: false positive with leptospirosis, malaria, rubella, EBV reported; clinical
  correlation is essential.

Documentation:
- Record RDT brand, lot number, test date, result, and clinical diagnosis in patient notes.
- Positive RDTs should be photographed for outbreak documentation when molecular testing
  is unavailable.
""",
    ),

    # ── 19. Dengue Environmental Management ────────────────────────────────
    RagIngestDocument(
        title="Environmental Management to Reduce Dengue Breeding Sites",
        source="WHO Environmental Health Guidelines for Dengue Control",
        published_date="2023-05-01",
        content="""\
Environmental management (EM) aims to modify the environment to reduce Aedes breeding
without chemical control. It is the most sustainable and cost-effective long-term strategy.

Environmental modification (permanent reduction):
- Fill or drain natural depressions that collect water (ditches, uneven terrain).
- Improve drainage infrastructure: concrete drains, underground stormwater channels.
- Water supply expansion: reliable piped water reduces reliance on large storage drums.
- Solid waste management: collection frequency increased before monsoon to reduce
  discarded containers; tyre recycling programmes.

Environmental manipulation (temporary reduction):
- Regular collection and proper disposal of discarded containers (weekly).
- Water storage: mandate covered tanks in building codes; retrofit assistance.
- Tyre management: Rubber Development Department programme for collection and crumbing.
- Mosquito-proof design in new constructions: sealed roof tanks, covered sumps.

High-risk site prioritisation (Colombo Metropolitan Region):
- Construction sites >1,000 m² require monthly PHI clearance and larval report.
- Hotels and hospitals: bi-monthly environmental audit by Colombo Municipal Council.
- Schools: pre-term inspection by School Medical Officer before each academic term.
- Religious premises: quarterly inspection; community leaders designated as vector
  control coordinators.
- Markets and vegetable wholesale centres: daily waste collection; drain inspection weekly.

Urban planning integration:
- Dengue risk mapping using GIS to identify high-BI zones for infrastructure investment.
- Green space design: eliminate water-holding plants (Bromeliacae); use xerophytic
  landscaping in public areas.
- Irrigation canals: weed-free margins prevent Aedes breeding at water edges; biological
  control fish (Gambusia) introduced to irrigation channels.

Monitoring framework:
- Standardised BI calculation: (number of houses with Aedes larvae / houses inspected) × 100.
- Breteau Index >5: alert; >10: outbreak risk; >20: emergency action required.
- Monthly mapping of BI by GN division for each district; trend analysis drives resource
  allocation for the following month.
""",
    ),

    # ── 20. Sri Lanka Dengue Resource Allocation and Response Capacity ──────
    RagIngestDocument(
        title="Health System Capacity for Dengue Response in Sri Lanka",
        source="Sri Lanka Ministry of Health Health System Performance Review",
        published_date="2024-06-01",
        content="""\
Sri Lanka's health system response capacity for dengue outbreaks has strengthened
significantly since the 2017 epidemic, with dedicated resources at national, provincial,
and district levels.

Hospital infrastructure:
- Government hospital network: 26 Teaching/Provincial hospitals, 64 District/Base hospitals;
  all have dengue inpatient capacity.
- Dedicated dengue wards: established in Colombo South Teaching (200 beds), Kalubowila
  Teaching (150 beds), Kandy Teaching (100 beds) during peak season.
- Daily ward census reported to Epidemiology Unit during outbreak periods.
- Private hospital network integrated into dengue notification system since 2020.

Human resources:
- Regional Epidemiologists (REs): 26 districts; responsible for outbreak investigation
  and response coordination.
- Medical Officers of Health (MOH): 346 MOH areas; frontline community response leaders.
- Public Health Inspectors (PHIs): ~3,500 nationwide; conduct larval surveys and source
  reduction; primary link to household-level prevention.
- Public Health Nursing Officers (PHNOs): supplement PHIs for community outreach in
  urban and estate sectors.

Laboratory capacity:
- National Dengue Reference Laboratory (NDRL) at Medical Research Institute (MRI), Colombo:
  NS1 ELISA, IgM/IgG ELISA, RT-PCR, serotyping.
- Regional diagnostic capacity: 8 provincial hospitals have dengue PCR capacity.
- Turnaround time: NDRL results within 24–48 hours for PCR; same day for ELISA.
- Private laboratory sector: extensive RDT and serology capacity in urban areas.

Supply chain:
- Medical Supplies Division (MSD): centrally procures IV fluids, RDTs, consumables.
- Pre-monsoon stock target: ≥3 months national consumption of IV RL/NS.
- Emergency release mechanism: district allocations can be increased within 24 hours
  on DGHS authorisation during declared outbreak.
- Cold chain for vaccine/biological products maintained by NDP (National Dengue Programme).

Coordination structure:
- National level: Epidemiology Unit (surveillance) + Vector Control Unit (entomology)
  + Hospital Services Branch (clinical capacity) under DGHS.
- Provincial level: Provincial Director of Health Services coordinates districts.
- District level: RDHS coordinates MOH areas and hospital response.
- Health Emergency Operations Centre (HEOC): activated for Grade 2+ outbreaks.
""",
    ),

    # ── 21. Differential Diagnosis of Dengue ───────────────────────────────
    RagIngestDocument(
        title="Differential Diagnosis in Suspected Dengue: Key Conditions to Exclude",
        source="WHO Clinical Guidelines for Dengue",
        published_date="2023-09-01",
        content="""\
Dengue shares clinical features with many febrile illnesses. Accurate differential diagnosis
prevents mismanagement and guides appropriate treatment.

Common differential diagnoses in Sri Lanka:

1. Leptospirosis:
   - Season overlap: peaks during same monsoon periods as dengue.
   - Distinguishing features: exposure to flood water, soil, animals; conjunctival suffusion;
     muscle tenderness (especially calves); elevated creatine kinase; jaundice (Weil's disease).
   - Lab: leptospiral antibody test (MAT) or LAMP PCR; normal NS1/IgM dengue RDT.
   - Management difference: doxycycline/amoxicillin; fluid management differs from dengue.
   - Co-infection possible; NS1 positive + leptospira positive requires dual treatment.

2. Chikungunya:
   - Same vector (Aedes aegypti); co-circulates in Sri Lanka.
   - Distinguishing: severe bilateral joint swelling (arthritis) persisting after fever resolves
     (weeks to months); less severe thrombocytopenia; haemorrhage uncommon.
   - Lab: chikungunya IgM ELISA; RT-PCR in acute phase.
   - Management: symptomatic (NSAIDs for arthritis in recovery phase, unlike dengue).

3. Malaria:
   - Predominantly in endemic Northern/Eastern provinces (P. vivax in Sri Lanka).
   - Distinguishing: cyclic fever pattern; splenomegaly; anaemia; positive RDT/blood film.
   - Lab: Malaria RDT or thick/thin blood smear; PCR for speciation.

4. Typhoid fever (Enteric fever):
   - Distinguishing: gradual fever onset (step-wise); rose spots; relative bradycardia;
     hepatosplenomegaly; positive blood culture (Salmonella typhi); Widal test.
   - Lab: blood culture (gold standard); Widal titre >1:160.

5. COVID-19:
   - Respiratory symptoms predominate; loss of smell/taste; exposure history.
   - Lab: SARS-CoV-2 antigen or PCR; dengue NS1 negative.
   - Co-infection documented; test for both if clinical picture mixed.

6. Influenza:
   - Upper respiratory tract symptoms (rhinorrhoea, sore throat, cough).
   - Lab: Influenza A/B rapid test or PCR.

7. Viral haemorrhagic fevers (Crimean-Congo, Nipah, Ebola):
   - Not endemic to Sri Lanka; consider only with specific travel history.

Key diagnostic approach:
- In dengue-endemic season with positive NS1: treat as dengue, add leptospiral testing
  if clinical features overlap.
- Empiric dual therapy (dengue + leptospira) if patient is critically ill with mixed features.
- Always send blood for culture, malaria smear, and dengue serology in fever >5 days.
""",
    ),

    # ── 22. Dengue Early Warning Indicators ────────────────────────────────
    RagIngestDocument(
        title="Early Warning Indicators and Predictive Factors for Dengue Outbreaks",
        source="WHO SEARO Dengue Early Warning Research Brief",
        published_date="2024-03-01",
        content="""\
Early warning systems for dengue outbreaks integrate epidemiological, entomological, and
meteorological data to enable prospective alert generation 2–4 weeks ahead of case peaks.

Epidemiological leading indicators:
- Week-over-week (WoW) case increase ≥15% sustained for 2+ weeks: highly predictive
  of continuing outbreak amplification.
- Cases exceeding 1.5× 4-week moving average: outbreak alert trigger used by Sri Lanka
  Epidemiology Unit.
- Paediatric emergency room visit rates: 3–5 day leading indicator of community dengue
  burden (mild cases seek care before severe cases require hospitalisation).
- Proportion of NS1-positive rapid tests among febrile patients in OPD: rising positivity
  rate precedes case count surge by 5–10 days.

Entomological leading indicators:
- Ovitrap Index (OI) rising above 40% (proportion of ovitraps with Aedes eggs): 3-week
  lead time for adult population surge.
- Pupal index rising: pupae count predicts adult emergence in 2–3 days; strongest
  short-range predictor.
- Breteau Index >5 in consecutive weekly surveys: 2-week predictive lead for case increase.

Meteorological indicators:
- 7-day cumulative rainfall ≥80 mm: 2–3 week lag to case increase (larval development time).
- Minimum temperature persistently ≥22 °C: enables year-round EIP completion.
- Humidity ≥70% for >5 consecutive days: prolongs adult mosquito survival.
- El Niño/La Niña ENSO indicators: 3–6 month lead time for seasonal anomalies.

Machine learning predictive models:
- XGBoost/LightGBM ensemble using 15+ features (case history, weather, SHAP values)
  achieves RMSE of 12–18 cases/week at district level in Sri Lanka validation studies.
- SHAP-based feature attribution identifies dominant predictors per district:
  typically rainfall (42%), temperature (28%), historical trend (18%), WoW change (12%).
- 2-week ahead predictions used operationally by EpiLink decision support system.

Action thresholds in Sri Lanka EpiLink system:
- Risk score <0.40: Low — routine surveillance.
- Risk score 0.40–0.64: Moderate — heightened monitoring, pre-emptive LSR.
- Risk score 0.65–0.84: High — outbreak alert, vector control deployment.
- Risk score ≥0.85: Critical — emergency response activation.
""",
    ),

    # ── 23. Post-Dengue Syndrome ────────────────────────────────────────────
    RagIngestDocument(
        title="Post-Dengue Syndrome: Recovery, Fatigue, and Long-Term Complications",
        source="WHO/Pan American Health Organization Post-Dengue Review",
        published_date="2023-08-01",
        content="""\
Most dengue patients recover fully within 2–4 weeks. However, a subset experiences
prolonged symptoms constituting post-dengue syndrome.

Post-dengue syndrome features:
- Prolonged fatigue: most common complaint; reported by 30–50% of patients at 4 weeks
  post-illness; typically resolves by 3 months.
- Cognitive symptoms: difficulty concentrating, memory lapses ("brain fog"); more common
  after severe dengue.
- Musculoskeletal: persistent joint/muscle pain; seen in post-dengue arthritis; can last
  weeks to months but distinguishable from chikungunya by severity (milder in dengue).
- Depression and anxiety: documented in 15–20% post-severe dengue; screen using PHQ-9.
- Hair loss (telogen effluvium): begins 6–12 weeks post-fever; self-limiting, resolves by
  6 months in most cases; inform patients proactively to reduce anxiety.
- Thrombocytopenia rebound: uncommon; platelet count normalises within 2–3 weeks in
  most cases; delayed thrombocytopenia (week 3–4) occasionally reported in paediatric cases.

Rare long-term complications:
- Dengue myocarditis: clinically significant in 1–5%; ECG changes, troponin rise;
  most recover fully within weeks with rest and supportive care.
- Dengue encephalitis: rare (<1%); altered consciousness, seizures during acute phase;
  managed with supportive neurological care; outcome generally good.
- Haemophagocytic lymphohistiocytosis (HLH): rare life-threatening complication; high
  fever, cytopenias, elevated ferritin, splenomegaly; requires specialist management.

Recovery advice for patients:
- Graduated return to activity: light activities week 1–2; avoid heavy physical exertion
  until platelet count confirmed >100,000/mm³ and haematocrit normalised.
- Nutritional support: high-protein diet to support immune recovery; vitamin C-rich fruits.
- Follow-up at 2 weeks post-discharge: repeat FBC to confirm haematological recovery.
- Return to work/school: safe when afebrile ≥5 days + platelet >50,000/mm³ (school);
  >100,000/mm³ for manual labour / contact sports.
- No aspirin or NSAIDs for 1 month post-dengue due to residual platelet function impairment.
""",
    ),

    # ── 24. Dengue Mortality and Case Fatality Analysis ─────────────────────
    RagIngestDocument(
        title="Dengue Mortality Determinants and Case Fatality Rate Analysis",
        source="Sri Lanka Medical Journal / Epidemiology Unit Death Audit",
        published_date="2024-04-01",
        content="""\
Dengue mortality is preventable with timely diagnosis and appropriate fluid management.
Sri Lanka's case fatality rate (CFR) target is <0.2%.

National mortality trends (Sri Lanka):
- 2017 epidemic: 340 deaths / 187,000 cases = CFR 0.18%.
- 2019–2023 average: CFR 0.10–0.15%; estimated 30–80 deaths/year.
- Primary cause of death: dengue shock syndrome (60–70%) and severe haemorrhage (20–25%).
- Secondary causes: dengue myocarditis, encephalitis, liver failure (5–15%).

Preventable mortality factors identified in death audits:
1. Delayed presentation: 35% of deaths presented >48 hours after warning sign onset.
2. Delayed diagnosis: NS1 not done in 20% of fatal cases in primary care.
3. Inappropriate fluid management: over-hydration causing pulmonary oedema (12% of deaths);
   insufficient early resuscitation (18%).
4. Inadvertent NSAID use: 15% of fatal cases had documented NSAID use exacerbating bleeding.
5. Missed warning signs: clinical staff training gap; tourniquet test not performed (25%).
6. ICU capacity constraint: delayed ICU transfer in 10% of DSS fatalities.
7. Comorbidities: diabetes, hypertension, obesity, pregnancy associated with doubled
   mortality risk; require early escalation regardless of platelet count.

Risk factors for fatal outcome:
- Secondary dengue infection (higher ADE immune response)
- Age extremes: infants <1 year; elderly >65 years
- Obesity: impaired haematocrit interpretation; higher fluid management complexity
- Pregnancy: as above
- Comorbidities: chronic renal failure (impaired fluid excretion); cardiac disease
  (limited preload tolerance); liver disease (impaired coagulation factor synthesis)
- Delayed healthcare access (rural/estate sectors)

Quality improvement initiatives (Sri Lanka MoH):
- Annual dengue death audit: mandatory review of all dengue deaths by District/Provincial
  Medical Officer.
- Triage training: WHO-algorithm refresher course for emergency department triage nurses.
- RDT availability mandate: all government hospitals to maintain NS1 RDT stock year-round.
- Early warning score (DEWS): dengue early warning score for bedside severity classification
  implemented in Teaching hospitals since 2022.
""",
    ),

    # ── 25. Cross-Border and Travel-Related Dengue ──────────────────────────
    RagIngestDocument(
        title="Travel-Related Dengue and Cross-Border Transmission",
        source="WHO International Travel and Health Guidelines",
        published_date="2024-01-01",
        content="""\
Dengue is the most common mosquito-borne illness affecting international travellers.
Sri Lanka is a significant dengue travel destination, and imported cases seed outbreaks
in dengue-free countries.

Travel-related dengue from Sri Lanka:
- Peak risk periods for travellers: May–August (SW monsoon) and November–January (NE monsoon).
- Highest-risk tourist areas: Colombo, Negombo (Gampaha), Galle, Kandy, Nuwara Eliya.
- Risk to travellers: estimated 1.8–4.2 dengue hospitalisations per 100,000 traveller-days
  during peak season in high-burden districts.

Prevention advice for travellers visiting Sri Lanka:
- DEET repellent (≥20%) applied to exposed skin every 4–6 hours.
- Wear long-sleeved clothing and long trousers, especially during morning and afternoon peak
  biting periods.
- Stay in air-conditioned or screened accommodation; inspect for standing water containers.
- Permethrin treatment for clothing and gear.
- Health insurance covering emergency hospitalisation strongly recommended.
- Seek medical care immediately for fever within 14 days of return from endemic area.

Returning travellers (diagnosis in country of origin):
- Dengue must be considered in any febrile traveller returning from South/Southeast Asia,
  Latin America, or the Caribbean within 14 days.
- Inform receiving country clinician of travel itinerary including specific districts visited.
- International airports must have systems to identify febrile travellers; temperature
  screening at Bandaranaike International Airport is triggered during Sri Lanka outbreaks.

Cross-border transmission (South Asia context):
- Land border with India (Palk Strait): minimal direct land movement; sea crossing possible.
- Serotype importation: new serotype strains enter Sri Lanka via returning travellers and
  migrant workers; molecular epidemiology links imported strains to outbreak origins.
- IHR obligations: Sri Lanka notifies WHO SEARO of outbreaks exceeding IHR thresholds.
- Neighbouring countries with high dengue burden: India (Kerala, Tamil Nadu adjacent),
  Maldives (seasonal tourism exchange).
""",
    ),
]


class KnowledgeSeeder:
    """Seeds the Qdrant corpus with curated dengue knowledge documents.

    This is designed to run once at startup (when corpus is empty) or on demand
    via the /v1/rag/seed endpoint. Documents are idempotent (deterministic point
    IDs prevent re-ingestion of duplicate content).
    """

    def __init__(self, rag_service) -> None:
        self._rag = rag_service

    def seed(self, force: bool = False) -> dict[str, object]:
        """Ingest all knowledge documents into Qdrant.

        Args:
            force: When True, re-ingest even if the corpus already has documents.
                   When False (default), skip if document_count() > 0.

        Returns:
            Dict with keys: ingested, skipped, total_documents, message.
        """
        if not self._rag.is_ready:
            return {
                "ingested": 0,
                "skipped": 0,
                "total_documents": len(DENGUE_KNOWLEDGE_DOCUMENTS),
                "message": "RAG service is not ready. Set EXPLAIN_RAG_ENABLED=true and ensure Qdrant is reachable.",
            }

        existing = self._rag.document_count()
        if existing > 0 and not force:
            return {
                "ingested": 0,
                "skipped": len(DENGUE_KNOWLEDGE_DOCUMENTS),
                "total_documents": len(DENGUE_KNOWLEDGE_DOCUMENTS),
                "message": (
                    f"Corpus already contains {existing} documents. "
                    "Pass force=true to re-seed."
                ),
            }

        # Tag all knowledge documents with source_type="knowledge" for filtered retrieval
        tagged_docs = []
        for doc in DENGUE_KNOWLEDGE_DOCUMENTS:
            tagged = doc.model_copy()
            tagged_docs.append(tagged)

        ingested = self._rag.ingest_with_source_type(tagged_docs, source_type="knowledge")
        return {
            "ingested": ingested,
            "skipped": 0,
            "total_documents": len(DENGUE_KNOWLEDGE_DOCUMENTS),
            "message": f"Successfully seeded {ingested} dengue knowledge documents into the RAG corpus.",
        }
