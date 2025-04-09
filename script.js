document.getElementById("upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
  
    if (file) {
      Tesseract.recognize(
        file,
        'eng', // language
        {
          logger: m => console.log(m), // optional progress logger
        }
      ).then(({ data: { text } }) => {
        console.log("OCR Result:\n", text);
        document.getElementById("output").textContent = extractPassportData(text);
      });
    }
  });
  
  function extractPassportData(text) {
    const data = {};
  
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  
    const mrzLine = lines.find(line => line.startsWith('P<BGD'));
    const mrzDataLine2 = lines[lines.indexOf(mrzLine) + 1];
  
    // Handle OCR misinterpretation of characters
    text = text.replace(/([KL])+/g, '<'); // Replace 'K' or 'L' with '<' when applicable
  
    if (mrzLine) {
      const mrzParts = mrzLine.split('<<');
  
      let surname = "";
      let givenNames = "";
      let fullName = "";
  
      if (mrzParts.length >= 2) {
        surname = mrzParts[0].replace('P<BGD', '').replace(/</g, ' ').trim();
        givenNames = mrzParts[1].replace(/</g, ' ').trim();
        fullName = `${surname} ${givenNames}`.trim();
      } else {
        surname = mrzParts[0].replace('P<BGD', '').replace(/</g, ' ').trim();
        fullName = surname; // fallback if givenNames missing
      }
  
      data.surname = surname;
      data.givenName = givenNames;
      data.fullName = fullName;
    }
  
    if (mrzDataLine2) {
      data.passportNumber = mrzDataLine2.slice(0, 9);
    }
  
    const dobRaw = mrzDataLine2.slice(13, 19);
    if (dobRaw) {
      const [yy, mm, dd] = [dobRaw.slice(0, 2), dobRaw.slice(2, 4), dobRaw.slice(4, 6)];
      const dobYear = parseInt(yy) > 30 ? `19${yy}` : `20${yy}`;
      data.dateOfBirth = `${dobYear}-${mm}-${dd}`;
    }
  
    const sex = mrzDataLine2[20];
    if (sex === 'F' || sex === 'M') {
      data.sex = sex;
    }
  
    const doeRaw = mrzDataLine2.slice(21, 27);
    if (doeRaw) {
      const [yy, mm, dd] = [doeRaw.slice(0, 2), doeRaw.slice(2, 4), doeRaw.slice(4, 6)];
      const expiryYear = parseInt(yy) > 30 ? `19${yy}` : `20${yy}`;
      data.dateOfExpiry = `${expiryYear}-${mm}-${dd}`;
    }
  
    data.nationality = "BANGLADESHI";
  
    return JSON.stringify(data, null, 2);
  }
  
  
  
  