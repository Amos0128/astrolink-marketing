const { exec } = require('child_process');
const os = require('os');

function openURL(url) {
  const platform = os.platform();
  let command;

  switch (platform) {
    case 'darwin':  // macOS
      command = `open "${url}"`;
      break;
    case 'win32':   // Windows
      command = `start "${url}"`;
      break;
    default:        // Linux and others
      command = `xdg-open "${url}"`;
      break;
  }

  exec(command, (error) => {
    if (error) {
      console.error('Error opening URL:', error);
      return;
    }
    console.log('Browser opened with URL:', url);
  });
}

// Prime Video URL
const url = 'https://www.primevideo.com/region/na/detail/0HAQAA7JM43QWX0H6GUD3IOF70/ref=atv_hm_hom_c_ywRzEs_brws_2_18?jic=8%7CEgRzdm9k';

// Open the URL in default browser
openURL(url);