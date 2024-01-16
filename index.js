const { google } = require('googleapis');

const axios = require('axios');
const fs = require('fs').promises;
const { exec } = require('child_process');

const credentials = require('./skillful-way-411412-f3deed74d73d.json');
const csvFilePath = 'output-csv-file.csv';

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/drive']
);

const drive = google.drive({ version: 'v3', auth });

async function uploadFileToDrive() {
  const fileMetadata = {
    name: 'output-csv-file.csv',
    mimeType: 'application/vnd.ms-excel',
  };

  const media = {
    mimeType: 'application/vnd.ms-excel',
    body: await fs.readFile(csvFilePath, 'utf-8'),
  };

  drive.files.create(
    {
      resource: fileMetadata,
      media: media,
      fields: 'id',
    },
    (err, file) => {
      if (err) {
        console.error('Error uploading file to Google Drive:', err);
      } else {
        console.log('File uploaded successfully. File ID:', file.data.id);
      }
    }
  );
}

async function runDockerScoutCves(imageName, finame) {
  const command = `docker scout cves  --format sarif --output output-file.json ${imageName}`;

  console.log(`Executing command: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.log(`Виникла помилка: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Помилка на стандартному потоці помилок: ${stderr}`);
      return;
    }
    console.log(`Вивід команди: ${stdout}`);
    return stdout;
  });

  try {
    const response = await fs.readFile('output-file.json', 'utf-8');
    const data = JSON.parse(response);

    const sarifData = data.runs[0].tool.driver.rules;
    parseSarifToJson(sarifData, finame, imageName);
  } catch (error) {
    console.error('Error executing docker scout cves:', error);
  }
}

function parseSarifToJson(sarifData, finame, imageName) {
  const csvData = sarifData.map(result => {
    return {
      imageName: imageName,
      severity: result.properties.cvssV3_severity,
      id: result.id,
      help: result.help.markdown,
    };
  });
  saveToCsv(csvData, finame);
}

async function saveToCsv(csvData, finame) {
  const csvOptions = { header: true };
  const csvFileName = `${finame}.csv`;

  await fs.writeFile(csvFileName, '');

  csvData.forEach(async data => {
    await fs.appendFile(
      csvFileName,
      `${data.imageName},${data.id},${data.severity},${data.help}\n`
    );
  });

  console.log(`CSV file saved: ${csvFileName}`);
  uploadFileToDrive();
}

const imageName = 'ubuntu';
const finame = 'output-csv-file';

runDockerScoutCves(imageName, finame);
