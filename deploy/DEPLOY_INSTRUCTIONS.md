# Genesis Block - Инструкция по деплою на VPS

## Информация о проекте
- **Домен:** game5.chedot.com
- **IP сервера:** 89.111.134.240
- **Стек:** FastAPI + MongoDB + Nginx (static web)

---

## Для Cursor AI - Задача деплоя

### Подключение к серверу
```bash
ssh root@89.111.134.240
```
Используйте SSH-ключ или учётные данные, выданные администратором. Не коммитьте пароли в репозиторий.

### Шаг 1: Установка Docker (если не установлен)
```bash
# Проверить наличие Docker
docker --version

# Если нет - установить:
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Установить docker-compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### Шаг 2: Создание папки проекта
```bash
mkdir -p /opt/genesis-block
cd /opt/genesis-block
```

### Шаг 3: Загрузка файлов
Загрузить содержимое папки `/app/deploy/` на сервер в `/opt/genesis-block/`

Структура должна быть (как в репозитории, папка `deploy/`):
```
/opt/genesis-block/deploy/
├── backend/
│   ├── Dockerfile
│   ├── server.py
│   └── requirements.txt
├── bot/
│   ├── btc_miner_bot.py
│   └── btc-miner-bot.service.example
├── frontend-web/
│   ├── index.html
│   ├── _expo/
│   └── ...
├── docker-compose.yml
├── docker-compose.dev.yml
├── nginx.conf
├── .env
└── ssl/
    ├── fullchain.pem
    └── privkey.pem
```

### Шаг 4: Получение SSL сертификата
```bash
# Установить certbot
apt update && apt install -y certbot

# Остановить nginx если запущен
systemctl stop nginx 2>/dev/null || true

# Получить сертификат
certbot certonly --standalone -d game5.chedot.com

# Скопировать сертификаты
mkdir -p /opt/genesis-block/ssl
cp /etc/letsencrypt/live/game5.chedot.com/fullchain.pem /opt/genesis-block/ssl/
cp /etc/letsencrypt/live/game5.chedot.com/privkey.pem /opt/genesis-block/ssl/
```

### Шаг 5: Запуск приложения
Базовый `docker-compose.yml` слушает только **127.0.0.1:8085** (HTTP) и **127.0.0.1:8445** (HTTPS); MongoDB и backend наружу не проброшены — дальше обычно стоит системный nginx с прокси на 8445.

```bash
cd /opt/genesis-block/deploy

docker compose up -d --build

docker compose ps
docker compose logs -f
```

Локальная разработка с открытыми портами (Mongo **27017**, API **8001**, nginx **80/443**):

```bash
cd /opt/genesis-block/deploy
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Шаг 5b: Бот @btc_miner_history_bot (опционально)
Файл `deploy/bot/btc_miner_bot.py` читает `TELEGRAM_BOT_TOKEN` и опционально `GENESIS_MINIAPP_URL` из `deploy/.env`. Пример unit: `deploy/bot/btc-miner-bot.service.example` → скопировать в `/etc/systemd/system/btc-miner-bot.service`, затем `systemctl daemon-reload && systemctl enable --now btc-miner-bot`.

### Шаг 6: Проверка работы
```bash
# API через контейнерный nginx (как на VPS за reverse-proxy)
curl -sk https://127.0.0.1:8445/api/health

# Проверить сайт
curl -I https://game5.chedot.com
```

---

## Альтернативный вариант (без Docker)

### Установка зависимостей
```bash
# Python и pip
apt update
apt install -y python3.11 python3.11-venv python3-pip nginx

# MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl enable mongod
systemctl start mongod
```

### Настройка backend
```bash
mkdir -p /opt/genesis-block
cd /opt/genesis-block

# Создать виртуальное окружение
python3.11 -m venv venv
source venv/bin/activate

# Установить зависимости
pip install -r backend/requirements.txt

# Создать systemd сервис
cat > /etc/systemd/system/genesis-backend.service << 'EOF'
[Unit]
Description=Genesis Block Backend
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/genesis-block/backend
Environment="PATH=/opt/genesis-block/venv/bin"
ExecStart=/opt/genesis-block/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable genesis-backend
systemctl start genesis-backend
```

### Настройка Nginx
```bash
# Скопировать frontend
cp -r frontend-web/* /var/www/genesis-block/

# Скопировать конфиг nginx
cp nginx.conf /etc/nginx/sites-available/genesis-block
ln -sf /etc/nginx/sites-available/genesis-block /etc/nginx/sites-enabled/

# Проверить конфиг
nginx -t

# Перезапустить
systemctl restart nginx
```

---

## Полезные команды

### Логи
```bash
# Docker
cd /opt/genesis-block/deploy
docker compose logs -f backend
docker compose logs -f frontend

# Systemd
journalctl -u genesis-backend -f
journalctl -u nginx -f
```

### Перезапуск
```bash
# Docker
cd /opt/genesis-block/deploy
docker compose restart

# Systemd
systemctl restart genesis-backend
systemctl restart nginx
```

### Обновление
```bash
cd /opt/genesis-block/deploy
docker compose down
# Загрузить новые файлы
docker compose build --no-cache
docker compose up -d
```

---

## Настройка Telegram WebApp

После деплоя настроить бота:
1. Открыть @BotFather
2. Выбрать бота
3. Menu Button → Edit → URL: `https://game5.chedot.com`
4. Или настроить Web App через /newapp

---

## Troubleshooting

### Сайт не открывается
```bash
# Проверить порты
ss -tlnp | grep -E '80|443|8001'

# Проверить firewall
ufw status
ufw allow 80
ufw allow 443
```

### Ошибка подключения к MongoDB
```bash
# Проверить статус
systemctl status mongod
# или для Docker
cd /opt/genesis-block/deploy && docker compose logs mongodb
```

### Backend не запускается
```bash
# Проверить логи
cd /opt/genesis-block/deploy && docker compose logs backend
# или
journalctl -u genesis-backend -n 50
```
