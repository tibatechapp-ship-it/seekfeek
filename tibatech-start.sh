#!/bin/bash
# هذا السكربت مخصص لتشغيل DeepSeek Harness (seekfeek) ضمن بيئة TibaTech
echo "🚀 مرحباً بك في بيئة TibaTech المخصصة لـ seekfeek"
echo "جاري تثبيت الاعتماديات..."
npm install
echo "جاري تشغيل الواجهة..."
npx @deepseek-ai/dsh web