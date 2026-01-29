import csv
import sys
from collections import defaultdict

def analyze_tycoons():
    input_file = 'nantes_sirene.csv'
    output_file = 'tycoons_report.md'
    csv_export = 'tycoons_list.csv'
    
    target_naf = '56.10A'
    # Include both integer and string representations just in case
    target_zips = {'44000', '44100', '44200', '44300', 44000, 44100, 44200, 44300}

    print(f"Loading {input_file}...")
    
    rows = []
    try:
        # Use simple open, assume uft-8 or latin-1 if fails.
        # Sirene files are often UTF-8.
        with open(input_file, mode='r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f, delimiter=';')
            
            # Normalize field names to lower case for safety
            # But DictReader keys are from the header line.
            # Let's map them.
            fieldnames = [f.lower() for f in reader.fieldnames]
            reader.fieldnames = fieldnames
            
            print(f"Fields found: {fieldnames}")
            
            for row in reader:
                # Filter 1: Activity
                naf = row.get('activiteprincipaleetablissement', '')
                if naf != target_naf:
                    continue
                
                # Filter 2: Zip Code
                # Clean zip
                raw_zip = row.get('codepostaletablissement', '')
                try:
                    clean_zip_val = int(float(raw_zip)) if raw_zip else 0
                except ValueError:
                    clean_zip_val = raw_zip
                
                if str(clean_zip_val) not in [str(z) for z in target_zips]:
                    continue
                
                # Filter 3: Active
                etat = row.get('etatadministratifetablissement', '')
                if etat != 'Actif':
                    continue
                    
                rows.append(row)
                
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        return

    print(f"Active Restaurants (56.10A) in Nantes target zones: {len(rows)}")

    # Grouping
    # Map: (siren, owner_name) -> list of establishments
    groups = defaultdict(list)
    
    for row in rows:
        siret = row.get('siret', '')
        siren = siret[:9] if len(siret) >= 9 else siret
        
        # Determine Owner Name
        denom = row.get('denominationunitelegale', '')
        nom = row.get('nomunitelegale', '')
        prenom = row.get('prenomusuelunitelegale', '')
        
        owner_name = "Inconnu"
        if denom:
            owner_name = denom
        elif nom:
            owner_name = f"{nom} {prenom}".strip()
            
        groups[(siren, owner_name)].append(row)
        
    # Analyze Groups
    tycoons = []
    for (siren, owner), establishments in groups.items():
        count = len(establishments)
        if count >= 2:
            # Extract aggregated info
            enseignes = set()
            adresses = set()
            for est in establishments:
                ens = est.get('enseigne1etablissement', '')
                if not ens:
                     ens = est.get('denominationusuelleetablissement', '')
                if ens:
                    enseignes.add(ens)
                
                addr = est.get('adresseetablissement', '')
                if addr:
                    adresses.add(addr)
            
            tycoons.append({
                'siren': siren,
                'owner_name': owner,
                'count': count,
                'enseignes': list(enseignes),
                'adresses': list(adresses)
            })
            
    # Sort by count descending
    tycoons.sort(key=lambda x: x['count'], reverse=True)
    
    print(f"Potential Tycoons found (>= 2 establishments): {len(tycoons)}")
    
    # Generate Report
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# Rapport Identification Tycoons - Nantes (Resto 56.10A)\n\n")
        f.write(f"**Total Restaurants Actifs (Cible):** {len(rows)}\n")
        f.write(f"**Groupes Multi-Etablissements (>=2) Identifiés:** {len(tycoons)}\n\n")
        
        f.write("## Top 20 Groupes par Nombre d'Etablissements\n\n")
        f.write("| Rang | Propriétaire / Structure | Nb Etablissements | Enseignes | Influence (Quartiers/Effectifs) |\n")
        f.write("|---|---|---|---|---|\n")
        
        for idx, t in enumerate(tycoons[:20]):
            enseignes_str = ", ".join(t['enseignes'][:3])
            if len(t['enseignes']) > 3:
                enseignes_str += "..."
            if not enseignes_str:
                enseignes_str = "(Nom commercial non renseigné)"
                
            influence = f"{len(t['adresses'])} adresses"
            
            f.write(f"| {idx+1} | {t['owner_name']} <br> *(SIREN: {t['siren']})* | {t['count']} | {enseignes_str} | {influence} |\n")
            
        f.write("\n## Détail Complet (CSV Exporté)\n")
        f.write("La liste complète avec adresses détaillées est disponible dans `tycoons_list.csv`.\n")

    # Generate CSV
    with open(csv_export, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Rang', 'Proprietaire', 'SIREN', 'Nb_Etablissements', 'Enseignes', 'Adresses'])
        for idx, t in enumerate(tycoons):
            writer.writerow([
                idx+1,
                t['owner_name'],
                t['siren'],
                t['count'],
                " | ".join(t['enseignes']),
                " | ".join(t['adresses'])
            ])
            
    print(f"Report generated: {output_file}")
    print(f"CSV generated: {csv_export}")

if __name__ == "__main__":
    analyze_tycoons()
