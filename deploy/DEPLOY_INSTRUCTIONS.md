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
# Пароль: 4t1niic6ib6d
```

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

Структура должна быть:
```
/opt/genesis-block/
├── backend/
│   ├── Dockerfile
│   ├── server.py
│   ├── requirements.txt
│   └── .env
├── frontend-web/
│   ├── index.html
│   ├── _expo/
│   └── ...
├── docker-compose.yml
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
```bash
cd /opt/genesis-block

# Запустить все сервисы
docker-compose up -d

# Проверить статус
docker-compose ps

# Посмотреть логи
docker-compose logs -f
```

### Шаг 6: Проверка работы
```bash
# Проверить API
curl http://localhost:8001/api/

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
docker-compose logs -f backend
docker-compose logs -f frontend

# Systemd
journalctl -u genesis-backend -f
journalctl -u nginx -f
```

### Перезапуск
```bash
# Docker
docker-compose restart

# Systemd
systemctl restart genesis-backend
systemctl restart nginx
```

### Обновление
```bash
cd /opt/genesis-block
docker-compose down
# Загрузить новые файлы
docker-compose build --no-cache
docker-compose up -d
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
docker-compose logs mongodb
```

### Backend не запускается
```bash
# Проверить логи
docker-compose logs backend
# или
journalctl -u genesis-backend -n 50
```
