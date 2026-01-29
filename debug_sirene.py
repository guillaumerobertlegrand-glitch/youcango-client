import csv

def debug_state():
    input_file = 'nantes_sirene.csv'
    target_naf = '56.10A'
    target_zips = {'44000', '44100', '44200', '44300'}
    
    try:
        with open(input_file, mode='r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f, delimiter=';')
            fieldnames = [f.lower() for f in reader.fieldnames]
            reader.fieldnames = fieldnames
            
            count = 0
            for row in reader:
                naf = row.get('activiteprincipaleetablissement', '')
                raw_zip = row.get('codepostaletablissement', '')
                
                is_target_zip = False
                if raw_zip in target_zips:
                    is_target_zip = True
                elif raw_zip and raw_zip.replace('.0', '') in target_zips:
                     is_target_zip = True
                     
                if naf == target_naf and is_target_zip:
                    etat = row.get('etatadministratifetablissement', 'N/A')
                    print(f"Row match: State='{etat}'")
                    count += 1
                    if count >= 20:
                        break
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_state()
