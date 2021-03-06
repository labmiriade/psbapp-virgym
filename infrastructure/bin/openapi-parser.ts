/**
 * This module is used to parse the openapi in `res/openapi/openapi.yaml`
 * into an exported object in lib/openapi.ts
 *
 * Should be lauched with `npm run openapi`
 */
const fs = require('fs');
const SwaggerParser = require('swagger-parser');

/**
 * Funzione che si occupa di leggere un file OpenAPI e genera un file typescript
 *
 * utilizzabile per definire Modelli.
 *
 * @param origin path del file che contiene l'open API spec file
 * @param destination path del file che deve contenere la versione parsata dell'API
 */
async function parseAndSave(origin: string, destination: string) {
  console.log(`will parse open-api at: ${origin}`);
  const parser = new SwaggerParser();
  const api = await parser.dereference(origin);
  console.log(`did parse definition`);
  const safeApi = stripExampleKeysFromSchemas(api);
  let aux = `/**
 * This File is autogenerated by ./bin/openapi-parser.ts
 * Should not be modified.
 */

`;
  aux += 'export const OpenAPI = ' + JSON.stringify(safeApi, null, 2);
  console.log(`will write to: ${destination}`);
  fs.writeFileSync(destination, aux);
  console.log(`did write to: ${destination}`);
}

function stripExampleKeysFromSchemas(schemas: any): any {
  // leaving the example keys will lead to:
  // Invalid model schema specified. Unsupported keyword(s):
  // ["example"], Invalid model schema specified. Unsupported keyword(s): ["example"]
  if (typeof schemas !== 'object') {
    return schemas;
  }
  for (const key in schemas) {
    if (schemas.hasOwnProperty(key)) {
      let value = schemas[key];
      if (key === 'example') {
        delete schemas[key];
      } else {
        if (typeof value === 'string') {
          // remove badly parsed characters
          value = value
            .replace('è', 'e')
            .replace('é', 'e')
            .replace('ù', 'u')
            .replace('ú', 'u')
            .replace('ò', 'o')
            .replace('ó', 'o')
            .replace('È', "E'");
        }
        schemas[key] = stripExampleKeysFromSchemas(value);
      }
    }
  }
  return schemas;
}

(async () => {
  await parseAndSave('../design/openapi.yml', './lib/open-api.ts');
})();
