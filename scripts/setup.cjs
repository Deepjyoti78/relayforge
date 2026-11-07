const { copyFileSync, existsSync, constants } = require('node:fs');
const { resolve } = require('node:path');

for (const filename of ['.env', '.env.test']) {
  const destination = resolve(__dirname, '..', filename);
  if (existsSync(destination)) {
    console.log(`${filename} already exists; preserved.`);
    continue;
  }
  copyFileSync(`${destination}.example`, destination, constants.COPYFILE_EXCL);
  console.log(`Created ${filename} with local development defaults.`);
}
