import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

export async function generateCertificate(participant, settings = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]);

  const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesRomanBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRomanItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  const { width, height } = page.getSize();

  const borderColor = rgb(0.13, 0.29, 0.53);
  const accentColor = rgb(0.8, 0.65, 0.13);

  // Optional: draw a logo image in the header if provided
  if (settings.logoBase64) {
    try {
      const logoBytes = new Uint8Array(Buffer.from(settings.logoBase64, 'base64'));
      const logoImage = await embedImage(pdfDoc, logoBytes);
      const logoWidth = 84;
      const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      const logoX = 42;
      const logoY = height - 112 - logoHeight / 2;
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (error) {
      console.error('Error embedding logo:', error);
    }
  }

  // Optional: draw a second logo on the right side
  if (settings.secondLogoBase64) {
    try {
      const logo2Bytes = new Uint8Array(Buffer.from(settings.secondLogoBase64, 'base64'));
      const logo2 = await embedImage(pdfDoc, logo2Bytes);
      const logoWidth = 84;
      const logoHeight = (logo2.height / logo2.width) * logoWidth;
      const logoX = width - 42 - logoWidth;
      const logoY = height - 112 - logoHeight / 2;
      page.drawImage(logo2, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
      });
    } catch (error) {
      console.error('Error embedding second logo:', error);
    }
  }

  // Outer border
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
    y: height - 123,
    size: 48,
    font: timesRomanBoldFont,
    color: borderColor,
  });

  const sub = 'OF PARTICIPATION';
  const subWidth = timesRomanFont.widthOfTextAtSize(sub, 20);
  page.drawText(sub, {
    x: width / 2 - subWidth / 2,
    y: height - 162,
    size: 20,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Event details
  const eventName = settings.eventName || 'HackManthan 2025';
  const eventDetails = settings.eventDetails || 'Participation Certificate';
  const eventNameSize = 16;
  const eventDetailsSize = 24;
  const spacingEvent = 6;

  const eventNameY = height - 191;
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
    start: { x: width / 2 - 150, y: height - 178 },
    end: { x: width / 2 + 150, y: height - 178 },
    thickness: 1,
    color: accentColor,
  });

  const certifyText = settings.certifyText || 'This is to certify that';
  const certifySize = 14;
  const certifySpacing = 12;
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
    y: height - 270,
    size: 22,
    font: timesRomanBoldFont,
    color: borderColor,
  });

  page.drawLine({
    start: { x: width / 2 - regWithNameWidth / 2 - 20, y: height - 282 },
    end: { x: width / 2 + regWithNameWidth / 2 + 20, y: height - 282 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  });

  const fatherPrefix = settings.fatherPrefix || 'S/O';
  const fatherText = `${fatherPrefix} ${participant.fatherName}`;
  const fatherWidth = timesRomanFont.widthOfTextAtSize(fatherText, 16);
  page.drawText(fatherText, {
    x: width / 2 - fatherWidth / 2,
    y: height - 305,
    size: 16,
    font: timesRomanFont,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Completion text paragraph
  const completionText = settings.completionText || `has successfully completed ${eventName}`;
  const completionWidth = timesRomanFont.widthOfTextAtSize(completionText, 14);
  page.drawText(completionText, {
    x: width / 2 - completionWidth / 2,
    y: height - 335,
    size: 14,
    font: timesRomanFont,
    color: rgb(0.2, 0.2, 0.2),
  });

  const completionSub = settings.completionSubText || 'with exceptional engagement and dedication.';
  const completionSubWidth = timesRomanFont.widthOfTextAtSize(completionSub, 14);
  page.drawText(completionSub, {
    x: width / 2 - completionSubWidth / 2,
    y: height - 357,
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

  // Authorized signature area
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
  const authorizedName = settings.authorizedName || '';
  const combined = authorizedName ? `${authorizedLabel} — ${authorizedName}` : authorizedLabel;
  page.drawText(combined, {
    x: authBaseX,
    y: lineY - 20,
    size: 10,
    font: timesRomanFont,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Organizer details at bottom-left
  const organizerName = settings.organizerName || '';
  const organizerWebsite = settings.organizerWebsite || '';
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
  if (settings.signatureBase64) {
    try {
      const signatureBytes = new Uint8Array(Buffer.from(settings.signatureBase64, 'base64'));
      const signImage = await embedImage(pdfDoc, signatureBytes);
      const signWidth = 140;
      const signHeight = (signImage.height / signImage.width) * signWidth;
      page.drawImage(signImage, {
        x: width - 260,
        y: 105,
        width: signWidth,
        height: signHeight,
      });
    } catch (error) {
      console.error('Error embedding signature:', error);
    }
  }

  // Optional: draw QR code if enabled
  if (settings.qrEnabled && settings.qrBaseUrl) {
    try {
      const qrUrl = new URL(settings.qrBaseUrl);
      qrUrl.searchParams.set('name', participant.name);
      qrUrl.searchParams.set('regNo', participant.regNo);
      
      const qrDataUrl = await QRCode.toDataURL(qrUrl.toString(), { 
        margin: 0, 
        scale: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      const qrBytes = new Uint8Array(Buffer.from(qrDataUrl.split(',')[1], 'base64'));
      const qrImage = await embedImage(pdfDoc, qrBytes);
      const qrSize = 88;
      const qrX = width / 2 - qrSize / 2;
      const qrY = 74;
      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// Embed PNG or JPEG into the pdf-lib document from raw bytes
async function embedImage(pdfDoc, bytes) {
  // Try PNG first, then JPEG
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return await pdfDoc.embedJpg(bytes);
  }
}
