# AI Chat 測試口令（可直接貼俾 AI）

工作目錄固定：

```bash
cd "/Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking"
```

## 一次測試

你可以直接同 AI 講：

```text
去 /Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking，幫我跑 npm run ai:test，完成後話我知 pass/fail。
```

## 視覺模式（開 browser）

```text
去 /Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking，幫我跑 npm run ai:test:headed。
```

## 持續循環測試（每 10 分鐘）

```text
去 /Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking，幫我跑 npm run ai:test:loop，除非我叫停，否則持續運行。
```

## 自訂間隔（例如每 5 分鐘）

```text
去 /Users/chetchung/edenchatbot and booking system 2026/EdenChatbotBooking，幫我跑 npm run test:chat:ai:loop -- 300。
```

## 密碼來源

測試登入帳密由 `.env.local` 提供：

- `E2E_PATIENT_EMAIL`
- `E2E_PATIENT_PASSWORD`

AI 不需要你每次手動輸入密碼；會自動用環境變數登入並重用 auth state。
