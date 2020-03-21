const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const {promise} = require('promise');

/* Uploading files using service account, no login needed */
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];


fs.readFile("./credentials/test_service_accounts.json", async  (err, content) => {
    if(err) {
        console.log(err);
        return;
    }
    let credentials = JSON.parse(content);
    const auth = new google.auth.JWT(
        credentials.client_email, null, credentials.private_key, SCOPES
    ); 
    console.log(await uploadFile(auth));
});


async function uploadFile(auth) {
  const drive = google.drive({version: 'v3', auth});

  let res = await drive.files.create({
      requestBody: {
        name: 'test2',
        uploadType: "media",
      },
      media: {
        mimeType: 'text/plain',
        body: 'Hello World'
    }
  });

  console.log(await drive.permissions.create({
    requestBody: {
      "role": "reader",
      "type": "anyone",
    },
    fields:"id",
    fileId: res.data.id
  }));
  return `https://www.googleapis.com/drive/v3/files/${res.data.id}?alt=media&key=AIzaSyBj-qabVIiLub5CrxIYSNUF4HoRIJGxWBE`
}