import { google } from 'googleapis';

const SCOPES = [
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events',
];

export async function getGoogleAuthClient() {
                const clientId = process.env.GOOGLE_CLIENT_ID;
                const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
                const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/oauth2callback';
                const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

                if (!clientId || !clientSecret || !refreshToken) {
                                throw new Error('Missing Google OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)');
                }

                const oAuth2Client = new google.auth.OAuth2(
                                clientId,
                                clientSecret,
                                redirectUri
                );

                oAuth2Client.setCredentials({
                                refresh_token: refreshToken,
                });

                return oAuth2Client;
}
