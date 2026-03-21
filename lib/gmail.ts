// Gmail integration using Replit Connector (google-mail)
import { google } from 'googleapis';

import { getGoogleAuthClient } from './google-auth';
import { getClinicInfoHtmlSections } from '@/shared/clinic-data';
import { getPublicBaseUrl } from '@/lib/public-url';

async function getUncachableGmailClient() {
  const auth = await getGoogleAuthClient();
  return google.gmail({ version: 'v1', auth });
}

interface ConfirmationEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorNameZh: string;
  clinicName: string;
  clinicNameZh: string;
  clinicAddress: string;
  date: string;
  time: string;
  eventId?: string;
  calendarId?: string;
}

interface ConsultationEmailData {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  reason: string;
}

interface CancellationEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorNameZh: string;
  clinicName: string;
  clinicNameZh: string;
  clinicAddress: string;
  date: string;
  time: string;
}

interface ReminderEmailData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  doctorNameZh: string;
  clinicName: string;
  clinicNameZh: string;
  clinicAddress: string;
  date: string;
  time: string;
  eventId: string;
  calendarId: string;
}

const CLINIC_WHATSAPP_CONTACTS = [
  { label: '佐敦診所', phoneDisplay: '+852 6733 3801', phoneDigits: '85267333801' },
  { label: '中環診所', phoneDisplay: '+852 6733 3234', phoneDigits: '85267333234' },
  { label: '荃灣診所', phoneDisplay: '+852 5189 9065', phoneDigits: '85251899065' },
] as const;

const CLINIC_GOOGLE_MAP_BY_NAME_ZH: Record<string, string> = {
  荃灣: 'https://maps.app.goo.gl/i18v8oYQAoG65XM66?g_st=ic',
  佐敦: 'https://maps.app.goo.gl/2pH44Tx6QQcWpn538?g_st=ic',
  中環: 'https://maps.app.goo.gl/G3S73hfG6qk5o3cs8?g_st=ic',
};

function getBaseUrl(): string {
  return getPublicBaseUrl();
}

function getBookingActionUrl(path: string, eventId: string, calendarId: string): string {
  const searchParams = new URLSearchParams();
  if (eventId) searchParams.append('eventId', eventId);
  if (calendarId) searchParams.append('calendarId', calendarId);
  return `${getBaseUrl()}${path}?${searchParams.toString()}`;
}

function buildClinicWhatsappLinksHtml(): string {
  return CLINIC_WHATSAPP_CONTACTS.map((contact) => {
    const link = `https://api.whatsapp.com/send/?phone=${contact.phoneDigits}&text&type=phone_number&app_absent=0`;
    return `<div style="margin: 8px 0;">
      <a href="${link}" class="whatsapp-link" target="_blank">${contact.label} WhatsApp：${contact.phoneDisplay}</a>
    </div>`;
  }).join('\n');
}

function buildClinicGoogleMapHtml(clinicNameZh: string): string {
  const mapUrl = CLINIC_GOOGLE_MAP_BY_NAME_ZH[clinicNameZh];
  if (!mapUrl) return '';

  return `<div style="margin: 16px 0; font-size: 14px;">
    <strong>Google Map（${clinicNameZh}）</strong><br>
    <a href="${mapUrl}" style="color:#5c8d4d;" target="_blank">${mapUrl}</a>
  </div>`;
}

function buildConfirmationEmailHtml(data: ConfirmationEmailData): string {
  const isOnlineConsultation = data.clinicNameZh === '網上';
  const clinicInfoHtml = isOnlineConsultation
    ? `<p>💻 <strong>網上應診 Online Consultation</strong><br>
請於預約時間前保持電話暢通，我們會按安排透過 Zoom / WhatsApp Video 與你聯絡。</p>`
    : getClinicInfoHtmlSections();
  const clinicWhatsappLinksHtml = isOnlineConsultation ? '' : buildClinicWhatsappLinksHtml();
  const clinicGoogleMapHtml = isOnlineConsultation ? '' : buildClinicGoogleMapHtml(data.clinicNameZh);
  const googleCalendarStart = data.date.replace(/-/g, '') + 'T' + data.time.replace(':', '') + '00';
  const [h, m] = data.time.split(':').map(Number);
  const endMinutes = h * 60 + m + 15;
  const endH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
  const endM = String(endMinutes % 60).padStart(2, '0');
  const googleCalendarEnd = data.date.replace(/-/g, '') + 'T' + endH + endM + '00';

  const eventTitle = encodeURIComponent(`醫天圓 - ${data.doctorNameZh} ${data.doctorName} 預約`);
  const eventDetails = encodeURIComponent(`Appointment with ${data.doctorNameZh} ${data.doctorName} at ${data.clinicNameZh}`);
  const eventLocation = encodeURIComponent(data.clinicAddress);

  const googleCalendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${googleCalendarStart}/${googleCalendarEnd}&details=${eventDetails}&location=${eventLocation}&ctz=Asia/Hong_Kong&sf=true&output=xml`;

  const dateObj = new Date(data.date + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  const dateFormatted = `${dayName}, ${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

  const rescheduleUrl = getBookingActionUrl('/reschedule', data.eventId || '', data.calendarId || '');
  const cancelUrl = getBookingActionUrl('/cancel', data.eventId || '', data.calendarId || '');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Noto Sans TC', sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background-color: #5c8d4d; padding: 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 4px; }
    .header p { color: #e0e0e0; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 32px 24px; }
    .booking-card { background: #f8faf6; border: 1px solid #e0e8d8; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .booking-card h3 { margin: 0 0 4px; color: #333; font-size: 16px; }
    .booking-card table { width: 100%; border-collapse: collapse; }
    .booking-card td { padding: 6px 0; vertical-align: top; }
    .booking-card td:first-child { color: #888; width: 80px; font-size: 14px; }
    .booking-card td:last-child { color: #333; font-size: 14px; }
    .thank-you { text-align: center; color: #5c8d4d; font-size: 16px; font-weight: bold; margin: 20px 0; }
    .whatsapp-link { display: inline-block; background: #25d366; color: #fff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin: 10px 0; }
    .divider { border: 0; border-top: 1px dashed #ccc; margin: 24px 0; }
    .clinic-info { font-size: 13px; color: #555; line-height: 1.8; }
    .clinic-info strong { color: #333; }
    .footer { background: #f0f0f0; padding: 16px 24px; font-size: 12px; color: #888; text-align: center; line-height: 1.8; }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 4px; font-size: 14px; }
    .btn-green { background-color: #5c8d4d; color: #fff !important; }
    .btn-outline { background-color: #fff; color: #5c8d4d !important; border: 1px solid #5c8d4d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>醫 天 圓</h1>
      <p>EDEN TCM CLINIC</p>
    </div>
    <div class="content">
      <h2 style="margin-top:0;">預約診症</h2>
      <p style="font-size:18px; font-weight:bold;">${data.patientName.toUpperCase()}</p>
      
      <div class="booking-card">
        <table>
          <tr>
            <td>預約</td>
            <td><strong>${data.doctorNameZh} ${data.doctorName}｜${data.clinicNameZh} ${data.clinicName}</strong></td>
          </tr>
          <tr>
            <td>時段</td>
            <td><strong>${dateFormatted} ${data.time}</strong></td>
          </tr>
          <tr>
            <td>地址</td>
            <td>${data.clinicAddress}</td>
          </tr>
        </table>
      </div>
      
      <p class="thank-you">感謝你，我們已成功為你預約。</p>
      
      <p style="font-size:14px;">如有任何疑問或查詢，請按此連結，<br>以 WHATSAPP 信息傳送各分店診所姑娘溝通，姑娘樂意回答你的不同查詢。</p>
      
      <div style="text-align:center; margin: 16px 0;">
        ${clinicWhatsappLinksHtml}
      </div>
      
      <hr class="divider">
      
      <div class="clinic-info">
        ${clinicInfoHtml}
        ${clinicGoogleMapHtml}
        
        ${
          isOnlineConsultation
            ? '<p>如需協助安排網上應診連結或流程，歡迎透過 WhatsApp 聯絡我們。</p>'
            : `<p>🔗 附上診所路綫圖，方便你參考：<br>
        <a href="https://www.edenclinic.hk/eden/關於我們/診所地址及聯絡方法/" style="color:#5c8d4d;">https://www.edenclinic.hk/eden/關於我們/診所地址及聯絡方法/</a></p>`
        }
      </div>
      
      <hr class="divider">
      
      <div style="text-align:center; margin: 20px 0;">
        <a href="${googleCalendarUrl}" class="btn btn-green" target="_blank">添加行程至 GOOGLE 日曆</a>
      </div>
      
      <hr class="divider">
      
      <div style="text-align:center; margin: 20px 0;">
        <p style="font-size:14px; color:#666; margin-bottom:12px;">需要更改預約？ Need to change your appointment?</p>
        <a href="${rescheduleUrl}" class="btn btn-outline" target="_blank">重新預約 RESCHEDULE</a>
        <a href="${cancelUrl}" class="btn btn-outline" target="_blank" style="background-color:#fff; color:#d32f2f !important; border-color:#d32f2f;">取消預約 CANCEL</a>
      </div>
    </div>
    <div class="footer">
      <p>【此電郵只作通知 / 確認預約用途，請勿回覆此郵件。】</p>
      <p>【溫馨提示】為減低病毒傳播風險和保護病人，到診時請盡量佩戴外科口罩。</p>
      <p>【📌預約前 1 小時無法自行更改/取消時間，如需要更改/取消請聯絡我們。】</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBookingConfirmationEmail(data: ConfirmationEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.patientEmail) {
      return { success: false, error: 'No email address provided' };
    }

    const gmail = await getUncachableGmailClient();

    const dateObj = new Date(data.date + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[dateObj.getDay()];
    const monthName = months[dateObj.getMonth()];
    const dateFormatted = `${dayName}, ${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

    const subject = `確認預約: 與${data.doctorNameZh} ${data.doctorName}｜${data.clinicNameZh} ${data.clinicName} ${dateFormatted} ${data.time} 的預約`;

    const htmlBody = buildConfirmationEmailHtml(data);

    const messageParts = [
      `To: ${data.patientEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64')
    ];

    const rawMessage = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    console.log(`Confirmation email sent to ${data.patientEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('Detailed Gmail Error:', error);
    if (error.response) {
      console.error('Gmail API Response Error:', error.response.data);
    }
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

function buildCancellationEmailHtml(data: CancellationEmailData): string {
  const clinicInfoHtml = getClinicInfoHtmlSections();
  const clinicWhatsappLinksHtml = buildClinicWhatsappLinksHtml();
  const clinicGoogleMapHtml = buildClinicGoogleMapHtml(data.clinicNameZh);
  const dateObj = new Date(data.date + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  const dateFormatted = `${dayName}, ${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Noto Sans TC', sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background-color: #b71c1c; padding: 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 4px; }
    .header p { color: #ffe9e9; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 32px 24px; }
    .booking-card { background: #fff5f5; border: 1px solid #f4caca; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .booking-card table { width: 100%; border-collapse: collapse; }
    .booking-card td { padding: 6px 0; vertical-align: top; }
    .booking-card td:first-child { color: #888; width: 80px; font-size: 14px; }
    .booking-card td:last-child { color: #333; font-size: 14px; }
    .status { text-align: center; color: #b71c1c; font-size: 16px; font-weight: bold; margin: 20px 0; }
    .whatsapp-link { display: inline-block; background: #25d366; color: #fff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin: 10px 0; }
    .divider { border: 0; border-top: 1px dashed #ccc; margin: 24px 0; }
    .clinic-info { font-size: 13px; color: #555; line-height: 1.8; }
    .clinic-info strong { color: #333; }
    .footer { background: #f0f0f0; padding: 16px 24px; font-size: 12px; color: #888; text-align: center; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>醫 天 圓</h1>
      <p>EDEN TCM CLINIC</p>
    </div>
    <div class="content">
      <h2 style="margin-top:0;">取消預約確認</h2>
      <p style="font-size:18px; font-weight:bold;">${data.patientName.toUpperCase()}</p>

      <div class="booking-card">
        <table>
          <tr>
            <td>已取消</td>
            <td><strong>${data.doctorNameZh} ${data.doctorName}｜${data.clinicNameZh} ${data.clinicName}</strong></td>
          </tr>
          <tr>
            <td>時段</td>
            <td><strong>${dateFormatted} ${data.time}</strong></td>
          </tr>
          <tr>
            <td>地址</td>
            <td>${data.clinicAddress}</td>
          </tr>
        </table>
      </div>

      <p class="status">你的預約已成功取消。</p>

      <p style="font-size:14px;">如需重新預約，請透過以下 WhatsApp 聯絡相關診所安排。</p>
      <div style="text-align:center; margin: 16px 0;">
        ${clinicWhatsappLinksHtml}
      </div>

      <hr class="divider">

      <div class="clinic-info">
        ${clinicInfoHtml}
        ${clinicGoogleMapHtml}
      </div>
    </div>
    <div class="footer">
      <p>【此電郵只作通知用途，請勿回覆此郵件。】</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBookingCancellationEmail(
  data: CancellationEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.patientEmail) {
      return { success: false, error: 'No email address provided' };
    }

    const gmail = await getUncachableGmailClient();

    const dateObj = new Date(data.date + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[dateObj.getDay()];
    const monthName = months[dateObj.getMonth()];
    const dateFormatted = `${dayName}, ${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

    const subject = `取消確認: 與${data.doctorNameZh} ${data.doctorName}｜${data.clinicNameZh} ${data.clinicName} ${dateFormatted} ${data.time} 的預約`;
    const htmlBody = buildCancellationEmailHtml(data);

    const messageParts = [
      `To: ${data.patientEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64'),
    ];

    const rawMessage = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage,
      },
    });

    console.log(`Cancellation email sent to ${data.patientEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('Detailed cancellation email error:', error);
    if (error.response) {
      console.error('Gmail API Response Error:', error.response.data);
    }
    return { success: false, error: error.message || 'Failed to send cancellation email' };
  }
}

function buildReminderEmailHtml(data: ReminderEmailData): string {
  const clinicInfoHtml = getClinicInfoHtmlSections();
  const clinicWhatsappLinksHtml = buildClinicWhatsappLinksHtml();
  const clinicGoogleMapHtml = buildClinicGoogleMapHtml(data.clinicNameZh);
  const dateObj = new Date(data.date + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[dateObj.getDay()];
  const monthName = months[dateObj.getMonth()];
  const dateFormatted = `${dayName}, ${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

  const rescheduleUrl = getBookingActionUrl('/reschedule', data.eventId, data.calendarId);
  const cancelUrl = getBookingActionUrl('/cancel', data.eventId, data.calendarId);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Noto Sans TC', sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; }
    .header { background-color: #5c8d4d; padding: 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: 4px; }
    .header p { color: #e0e0e0; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 32px 24px; }
    .booking-card { background: #f8faf6; border: 1px solid #e0e8d8; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .booking-card table { width: 100%; border-collapse: collapse; }
    .booking-card td { padding: 6px 0; vertical-align: top; }
    .booking-card td:first-child { color: #888; width: 80px; font-size: 14px; }
    .booking-card td:last-child { color: #333; font-size: 14px; }
    .warning { margin: 18px 0; padding: 14px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 14px; }
    .btn { display: inline-block; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 4px; font-size: 14px; }
    .btn-green { background-color: #5c8d4d; color: #fff !important; }
    .btn-red-outline { background-color: #fff; color: #d32f2f !important; border: 1px solid #d32f2f; }
    .divider { border: 0; border-top: 1px dashed #ccc; margin: 24px 0; }
    .clinic-info { font-size: 13px; color: #555; line-height: 1.8; }
    .clinic-info strong { color: #333; }
    .footer { background: #f0f0f0; padding: 16px 24px; font-size: 12px; color: #888; text-align: center; line-height: 1.8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>醫 天 圓</h1>
      <p>EDEN TCM CLINIC</p>
    </div>
    <div class="content">
      <h2 style="margin-top:0;">預約提醒（24 小時前）</h2>
      <p style="font-size:18px; font-weight:bold;">${data.patientName.toUpperCase()}</p>

      <div class="booking-card">
        <table>
          <tr>
            <td>預約</td>
            <td><strong>${data.doctorNameZh} ${data.doctorName}｜${data.clinicNameZh} ${data.clinicName}</strong></td>
          </tr>
          <tr>
            <td>時段</td>
            <td><strong>${dateFormatted} ${data.time}</strong></td>
          </tr>
          <tr>
            <td>地址</td>
            <td>${data.clinicAddress}</td>
          </tr>
        </table>
      </div>

      <div class="warning">
        如你未能出席，請盡快提前取消或改期，方便診所安排，謝謝配合。
      </div>

      <p style="font-size:14px; margin-top: 4px;">如需協助，請透過以下 WhatsApp 聯絡診所：</p>
      <div style="text-align:center; margin: 12px 0 20px 0;">
        ${clinicWhatsappLinksHtml}
      </div>

      <div style="text-align:center; margin: 20px 0;">
        <a href="${rescheduleUrl}" class="btn btn-green" target="_blank">重新預約 RESCHEDULE</a>
        <a href="${cancelUrl}" class="btn btn-red-outline" target="_blank">取消預約 CANCEL</a>
      </div>

      <hr class="divider">

      <div class="clinic-info">
        ${clinicInfoHtml}
        ${clinicGoogleMapHtml}
      </div>
    </div>
    <div class="footer">
      <p>【此電郵只作通知用途，請勿回覆此郵件。】</p>
      <p>【如預約前 1 小時內需要更改，請直接聯絡診所。】</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBookingReminderEmail(
  data: ReminderEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.patientEmail) {
      return { success: false, error: 'No email address provided' };
    }

    const gmail = await getUncachableGmailClient();

    const dateObj = new Date(data.date + 'T00:00:00');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[dateObj.getDay()];
    const monthName = months[dateObj.getMonth()];
    const dateFormatted = `${dayName}, ${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;

    const subject = `預約提醒（24小時後）: 與${data.doctorNameZh} ${data.doctorName}｜${data.clinicNameZh} ${data.clinicName} ${dateFormatted} ${data.time}`;
    const htmlBody = buildReminderEmailHtml(data);

    const messageParts = [
      `To: ${data.patientEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64')
    ];

    const rawMessage = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });

    console.log(`Reminder email sent to ${data.patientEmail}`);
    return { success: true };
  } catch (error: any) {
    console.error('Detailed reminder email error:', error);
    if (error.response) {
      console.error('Gmail API Response Error:', error.response.data);
    }
    return { success: false, error: error.message || 'Failed to send reminder email' };
  }
}

function buildConsultationEmailHtml(data: ConsultationEmailData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, 'Noto Sans TC', sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 20px; background: #f5f5f5; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; }
    h1 { margin: 0 0 16px; font-size: 20px; color: #2d5016; }
    table { width: 100%; border-collapse: collapse; }
    td { border-top: 1px solid #f0f0f0; padding: 10px 0; vertical-align: top; }
    td:first-child { width: 90px; color: #666; }
    .reason { white-space: pre-line; }
  </style>
</head>
<body>
  <div class="card">
    <h1>新諮詢表單通知</h1>
    <table>
      <tr><td>姓名</td><td><strong>${data.patientName}</strong></td></tr>
      <tr><td>電話</td><td>${data.patientPhone}</td></tr>
      <tr><td>電郵</td><td>${data.patientEmail}</td></tr>
      <tr><td>症狀</td><td class="reason">${data.reason}</td></tr>
    </table>
  </div>
</body>
</html>`;
}

export async function sendConsultationNotificationEmail(
  data: ConsultationEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const to = process.env.CLINIC_NOTIFICATION_EMAIL;
    if (!to) {
      return { success: false, error: 'Missing CLINIC_NOTIFICATION_EMAIL' };
    }

    const gmail = await getUncachableGmailClient();
    const subject = `新諮詢：${data.patientName} (${data.patientPhone})`;
    const htmlBody = buildConsultationEmailHtml(data);
    const messageParts = [
      `To: ${to}`,
      `Reply-To: ${data.patientEmail}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64'),
    ];

    const rawMessage = Buffer.from(messageParts.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Consultation email error:', error);
    return { success: false, error: error.message || 'Failed to send consultation email' };
  }
}
