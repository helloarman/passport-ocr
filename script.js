document.getElementById("upload").addEventListener("change", function (e) {
  const file = e.target.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.src = event.target.result;

      img.onload = function () {
        Tesseract.recognize(
          img,
          'eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                const progress = m.progress;
                document.getElementById('ocr-progress').value = progress;
                document.getElementById('progress-text').textContent = `${Math.round(progress * 100)}%`;
              }
            }
          }
        ).then(({ data: { text } }) => {
          console.log("OCR Result:\n", text);
          document.getElementById("output").textContent = extractPassportData(text);
        });
      };
    };
    reader.readAsDataURL(file);
  }
});

function extractPassportData(text) {
  const data = {};
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

  // Fix common OCR misreads
  text = text.replace(/([KL])+/g, '<');

  const mrzLine = lines.find(line => line.startsWith('P<BGD'));
  const mrzDataLine2 = mrzLine ? lines[lines.indexOf(mrzLine) + 1] : '';

  // === MRZ Extraction ===
  if (mrzLine) {
    const mrzParts = mrzLine.split('<<');
    let surname = "";
    let givenNames = "";
    let fullName = "";

    if (mrzParts.length >= 2) {
      surname = cleanMRZName(mrzParts[0].replace('P<BGD', ''));
      givenNames = cleanMRZName(mrzParts[1] || '');
      fullName = `${givenNames} ${surname}`.trim();
    } else {
      surname = cleanMRZName(mrzParts[0].replace('P<BGD', ''));
      fullName = surname;
    }

    data.surname = surname;
    data.givenName = givenNames;
    data.fullName = fullName;
  }

  if (mrzDataLine2) {
    data.passportNumber = mrzDataLine2.slice(0, 9);
    const dobRaw = mrzDataLine2.slice(13, 19);
    if (dobRaw.length === 6) {
      const [yy, mm, dd] = [dobRaw.slice(0, 2), dobRaw.slice(2, 4), dobRaw.slice(4, 6)];
      const dobYear = parseInt(yy) > 30 ? `19${yy}` : `20${yy}`;
      data.dateOfBirth = `${dobYear}-${mm}-${dd}`;
    }
    
    const sex = mrzDataLine2[20];
    if (sex === 'F' || sex === 'M') {
      data.sex = sex;
    }
    
    const doeRaw = mrzDataLine2.slice(21, 27);
    if (doeRaw.length === 6) {
      const [yy, mm, dd] = [doeRaw.slice(0, 2), doeRaw.slice(2, 4), doeRaw.slice(4, 6)];
      const expiryYear = convertYear(yy, true);
      data.dateOfExpiry = `${expiryYear}-${mm}-${dd}`;
    }
    
    if (doeRaw.length === 6) {
      const [yy, mm, dd] = [doeRaw.slice(0, 2), doeRaw.slice(2, 4), doeRaw.slice(4, 6)];
      const issueYear = convertYear(yy, true);

      if (issueYear > new Date().getFullYear()) {
        issueYear -= 10;
      }
      data.dateOfIssue = `${issueYear}-${mm}-${dd}`;
    }
  }

  // === Try to Extract Additional Fields from Full Text ===

  const fullText = text.toUpperCase();

  // Father’s Name
  const fatherMatch = fullText.match(/FATHER(?:'S)?(?: NAME)?:?\s*([A-Z\s]+)/);
  if (fatherMatch) {
    data.fathersName = fatherMatch[1].trim();
  }

  // Mother’s Name
  const motherMatch = fullText.match(/MOTHER(?:'S)?(?: NAME)?:?\s*([A-Z\s]+)/);
  if (motherMatch) {
    data.mothersName = motherMatch[1].trim();
  }

  // Nationality
  if (fullText.includes("BGD")) {
    data.nationality = "BANGLADESHI";
  }

  return JSON.stringify(data, null, 2);
}

function convertYear(twoDigitYear, isExpiry = false) {
  const currentYear = new Date().getFullYear();
  const cutoff = currentYear % 100;
  const century = isExpiry || parseInt(twoDigitYear) > cutoff ? 2000 : 1900;
  return century + parseInt(twoDigitYear);
}

function cleanMRZName(name) {
  return name
    .replace(/([KLC]){2,}/g, ' ')
    .replace(/\bK\b/g, '')
    .replace(/[<|,0-9~!@#$€%^&*()_+={}\[\]:;"'<>.?\\/|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
