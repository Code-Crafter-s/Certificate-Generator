import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';


export async function generateCertificate(participant, options = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);

  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const { width, height } = page.getSize();

  const borderColor = rgb(0.13, 0.29, 0.53);
  const accentColor = rgb(0.8, 0.65, 0.13);

  // Optional: draw a logo image in the header if provided (no border, 1px offset from inner frame at x=40)
  if (options.logoBytes) {
    try {
      const logoImage = await embedImage(pdfDoc, options.logoBytes);
      const logoWidth = 90;
      const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      const logoX = 41;
      const logoY = height - 110 - logoHeight / 2;
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch {}
  }

  // Optional: draw a second logo on the right side if provided
  if (options.secondLogoBytes) {
    try {
      const logo2 = await embedImage(pdfDoc, options.secondLogoBytes);
      const logoWidth = 90;
      const logoHeight = (logo2.height / logo2.width) * logoWidth;
      const logoX = width - 41 - logoWidth;
      const logoY = height - 110 - logoHeight / 2;
      page.drawImage(logo2, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch {}
  }

  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: borderColor,
    borderWidth: 3,
  });

  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: accentColor,
    borderWidth: 1.5,
  });

  const title = 'CERTIFICATE';
  const titleWidth = timesRomanBoldFont.widthOfTextAtSize(title, 48);
  page.drawText(title, {
    x: width / 2 - titleWidth / 2,
    y: height - 120,
    size: 48,
    font: timesRomanBoldFont,
    color: borderColor,
  });

  const sub = 'OF PARTICIPATION';
  const subWidth = timesRomanFont.widthOfTextAtSize(sub, 20);
  page.drawText(sub, {
    x: width / 2 - subWidth / 2,
    y: height - 160,
    size: 20,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Event details under title (tight spacing and centered)
  const eventName = options.eventName || 'HackManthan 2025';
  const eventDetails = options.eventDetails || 'Participation Certificate';
  const eventNameSize = 16;
  const eventDetailsSize = 24; // visually emphasized per user
  const spacingEvent = 2; // 2pt between lines

  // Positioning below subtitle/line
  const eventNameY = height - 185;
  const eventDetailsY = eventNameY - spacingEvent - eventDetailsSize;

  const eventNameWidth = timesRomanBoldFont.widthOfTextAtSize(eventName, eventNameSize);
  page.drawText(eventName, {
    x: width / 2 - eventNameWidth / 2,
    y: eventNameY,
    size: eventNameSize,
    font: timesRomanBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  const detailsWidth = timesRomanFont.widthOfTextAtSize(eventDetails, eventDetailsSize);
  page.drawText(eventDetails, {
    x: width / 2 - detailsWidth / 2,
    y: eventDetailsY,
    size: eventDetailsSize,
    font: timesRomanFont,
    color: rgb(0.35, 0.35, 0.35),
  });

  page.drawLine({
    start: { x: width / 2 - 150, y: height - 173 },
    end: { x: width / 2 + 150, y: height - 173 },
    thickness: 1,
    color: accentColor,
  });

  const certifyText = options.certifyText || 'This is to certify that';
  const certifySize = 14;
  const certifySpacing = 6; // add a bit more breathing room
  const certifyY = eventDetailsY - certifySpacing - certifySize;
  const certifyWidth = timesRomanItalicFont.widthOfTextAtSize(certifyText, certifySize);
  page.drawText(certifyText, {
    x: width / 2 - certifyWidth / 2,
    y: certifyY,
    size: certifySize,
    font: timesRomanItalicFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Registration No. with Name on one line
  const regWithName = `${participant.regNo} ${participant.name}`;
  const regWithNameWidth = timesRomanBoldFont.widthOfTextAtSize(regWithName, 22);
  page.drawText(regWithName, {
    x: width / 2 - regWithNameWidth / 2,
    y: height - 245,
    size: 22,
    font: timesRomanBoldFont,
    color: borderColor,
  });

  page.drawLine({
    start: { x: width / 2 - regWithNameWidth / 2 - 20, y: height - 255 },
    end: { x: width / 2 + regWithNameWidth / 2 + 20, y: height - 255 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  const fatherPrefix = options.fatherPrefix || 'S/O';
  const fatherText = `${fatherPrefix} ${participant.fatherName}`;
  const fatherWidth = timesRomanFont.widthOfTextAtSize(fatherText, 16);
  page.drawText(fatherText, {
    x: width / 2 - fatherWidth / 2,
    y: height - 280,
    size: 16,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Completion text paragraph
  const completionText = options.completionText || `has successfully completed ${eventName}`;
  const completionWidth = timesRomanFont.widthOfTextAtSize(completionText, 14);
  page.drawText(completionText, {
    x: width / 2 - completionWidth / 2,
    y: height - 315,
    size: 14,
    font: timesRomanFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  const completionSub = options.completionSubText || 'with exceptional engagement and dedication.';
  const completionSubWidth = timesRomanFont.widthOfTextAtSize(completionSub, 14);
  page.drawText(completionSub, {
    x: width / 2 - completionSubWidth / 2,
    y: height - 335,
    size: 14,
    font: timesRomanFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  const date = new Date(participant.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  page.drawText('Date:', {
    x: 100,
    y: 120,
    size: 12,
    font: timesRomanBoldFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText(date, {
    x: 100,
    y: 100,
    size: 12,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Removed bottom registration block per request

  // Authorized signature area with inline authorized name
  const authBaseX = width - 260;
  const lineY = 100;
  page.drawText('___________________', {
    x: authBaseX,
    y: lineY,
    size: 12,
    font: timesRomanFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  const authorizedLabel = 'Authorized Signature';
  const authorizedName = options.authorizedName || '';
  const combined = authorizedName ? `${authorizedLabel} — ${authorizedName}` : authorizedLabel;
  page.drawText(combined, {
    x: authBaseX,
    y: lineY - 20,
    size: 10,
    font: timesRomanFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Organizer details at bottom-left
  const organizerName = options.organizerName || '';
  const organizerWebsite = options.organizerWebsite || '';
  if (organizerName) {
    page.drawText(organizerName, {
      x: 100,
      y: 80,
      size: 12,
      font: timesRomanBoldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
  }
  if (organizerWebsite) {
    page.drawText(organizerWebsite, {
      x: 100,
      y: 64,
      size: 10,
      font: timesRomanFont,
      color: rgb(0.35, 0.35, 0.35),
    });
  }

  // Optional: draw signature image if provided
  if (options.signatureBytes) {
    try {
      const signImage = await embedImage(pdfDoc, options.signatureBytes);
      const signWidth = 140;
      const signHeight = (signImage.height / signImage.width) * signWidth;
      page.drawImage(signImage, {
        x: width - 260,
        y: 105,
        width: signWidth,
        height: signHeight,
      });
    } catch {}
  }

  // Optional: draw QR code if provided
  if (options.qrBytes) {
    try {
      const qrImage = await embedImage(pdfDoc, options.qrBytes);
      const qrSize = 88; // 2px smaller
      const qrX = width / 2 - qrSize / 2; // horizontally centered
      const qrY = 74; // between date (left) and authorized (right)
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    } catch {}
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

export function downloadPDF(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Embed PNG or JPEG into the pdf-lib document from raw bytes
async function embedImage(pdfDoc, bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  // Try PNG first, then JPEG
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return await pdfDoc.embedJpg(bytes);
  }
}
