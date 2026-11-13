#!/bin/bash
echo "🚀 بدء تجهيز بيئة TibaTech Master..."

# تثبيت حزم MCP المطلوبة عالمياً
echo "[1/3] تثبيت خوادم MCP (Filesystem, Memory, Browser)..."
npm install -g @modelcontextprotocol/server-filesystem @modelcontextprotocol/server-memory @modelcontextprotocol/server-browser

# تشغيل النظام بالبروفايل الشامل
echo "[2/3] تشغيل النظام بالبروفايل الشامل (Ralph Loop + Agent Teams)..."
echo "[3/3] جاري فتح الواجهة..."
npx @deepseek-ai/dsh web --profile tibatech-power
