const fs = require('fs');
const path = './src/server/routes';
const files = fs.readdirSync(path);
for (const file of files) {
  if (file.endsWith('.ts')) {
    const filePath = path + '/' + file;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\(req\.params\.\s*as string\)/g, 'req.params.paramPlaceholder');
    // We don't know the exact names. Let's fix it manually per file based on git checkout or just rewrite.
  }
}
