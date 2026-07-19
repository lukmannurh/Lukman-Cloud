import https from 'https';
https.get('https://lukman-cloud.vercel.app/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!match) return console.log('Could not find JS bundle');
    https.get('https://lukman-cloud.vercel.app' + match[1], (res2) => {
      let jsData = '';
      res2.on('data', chunk => jsData += chunk);
      res2.on('end', () => {
        console.log('JS Bundle found:', match[1]);
        console.log('Includes Jargon?', jsData.includes('UNIFIED STORAGE POOL CORE'));
        console.log('Includes speedometer?', jsData.includes('speedometer'));
      });
    });
  });
});
