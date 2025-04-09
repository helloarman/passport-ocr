document.getElementById("upload").addEventListener("change", function (e) {
    const file = e.target.files[0];
  
    if (file) {
      Tesseract.recognize(
        blob,
        'eng', // language
        {
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ<',
          logger: m => console.log(m), // optional progress logger
        }
      ).then(({ data: { text } }) => {
        console.log("OCR Result:\n", text);
        document.getElementById("output").textContent = extractPassportData(text);
      });
    }
  });

  let cropper;
const uploadInput = document.getElementById('upload');
const outputElement = document.getElementById('output');
const imageElement = document.getElementById('image');
const cropBtn = document.getElementById('crop-btn');

uploadInput.addEventListener("change", function (e) {
    const file = e.target.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            imageElement.src = event.target.result;
            // Initialize Cropper.js
            if (cropper) {
                cropper.destroy();
            }
            cropper = new Cropper(imageElement, {
                aspectRatio: 16 / 10, // Customize aspect ratio as needed
                viewMode: 1,
                autoCropArea: 0.5,
            });
        };
        reader.readAsDataURL(file);
    }
});

cropBtn.addEventListener('click', function () {
    if (!cropper) return;
    
    const croppedCanvas = cropper.getCroppedCanvas();
    
    // Convert cropped canvas to a Blob for Tesseract.js
    croppedCanvas.toBlob(function (blob) {
        Tesseract.recognize(
            blob,
            'eng',
            {
                logger: m => console.log(m),
            }
        ).then(({ data: { text } }) => {
            console.log("OCR Result:\n", text);
            outputElement.textContent = extractPassportData(text);
        });
    });

    cropper.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      width: 800, // increase resolution
      height: 250,
    }).toBlob(function (blob) {
      Tesseract.recognize(blob, 'eng', {
        logger: m => console.log(m),
      }).then(({ data: { text } }) => {
        outputElement.textContent = extractPassportData(text);
      });
    });
    
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
    if (doeRaw.length === 6) {
      const [yy, mm, dd] = [doeRaw.slice(0, 2), doeRaw.slice(2, 4), doeRaw.slice(4, 6)];
      const expiryYear = convertYear(yy, true); // mark as expiry
      data.dateOfExpiry = `${expiryYear}-${mm}-${dd}`;
    }
  
    data.nationality = "BANGLADESHI";
  
    return JSON.stringify(data, null, 2);
  }

  function convertYear(twoDigitYear, isExpiry = false) {
    const currentYear = new Date().getFullYear();
    const cutoff = currentYear % 100; // e.g. 2025 → 25
    const century = isExpiry || parseInt(twoDigitYear) > cutoff ? 2000 : 1900;
    return century + parseInt(twoDigitYear);
  }
  
  function cleanMRZName(name) {
    return name
      .replace(/([KLC]){2,}/g, ' ')                     // Replace 2+ consecutive K/L/C with space
      .replace(/\bK\b/g, '')                           // Remove standalone "K"
      .replace(/[<|,0-9~`!@#$%^&*()_+={}\[\]:;"'<>.?\\/|-]/g, ' ') // Remove special chars and digits
      .replace(/\s+/g, ' ')                             // Collapse multiple spaces
      .trim();
  }
  
  
  