#!/bin/bash
set -e

# ============================================
# T-CARDIO PRO - DEPLOYMENT SCRIPT
# ============================================
# Usage: ./deploy.sh [setup|deploy|ssl|logs|restart|status]

DOMAIN="tcardio.tibla.terrano-hosting.com"
PROJECT_DIR="/opt/tcardio"
REPO_URL=""  # Set if using git

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[TCARDIO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ==================== INITIAL SERVER SETUP ====================
setup_server() {
    log "=== Mise a jour du systeme ==="
    apt update && apt upgrade -y

    log "=== Installation des paquets essentiels ==="
    apt install -y \
        curl wget git htop vim ufw fail2ban \
        ca-certificates gnupg lsb-release \
        software-properties-common

    log "=== Installation de Docker ==="
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
        systemctl enable docker
        systemctl start docker
        log "Docker installe avec succes"
    else
        log "Docker deja installe"
    fi

    log "=== Installation de Docker Compose ==="
    if ! command -v docker compose &> /dev/null; then
        apt install -y docker-compose-plugin
        log "Docker Compose installe"
    else
        log "Docker Compose deja installe"
    fi

    log "=== Configuration du firewall ==="
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw --force enable
    log "Firewall configure (SSH + HTTP + HTTPS)"

    log "=== Configuration de fail2ban ==="
    systemctl enable fail2ban
    systemctl start fail2ban

    log "=== Configuration du swap (2GB) ==="
    if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
        log "Swap de 2GB cree"
    else
        log "Swap deja configure"
    fi

    log "=== Creation du repertoire projet ==="
    mkdir -p $PROJECT_DIR

    log ""
    log "========================================="
    log " Setup serveur termine !"
    log " Prochaine etape: copier les fichiers"
    log "========================================="
}

# ==================== DEPLOY APPLICATION ====================
deploy() {
    log "=== Deploiement de T-Cardio Pro ==="

    cd $PROJECT_DIR

    # Verify required files
    if [ ! -f ".env.production" ]; then
        error "Fichier .env.production manquant dans $PROJECT_DIR"
    fi

    if [ ! -f "docker-compose.prod.yml" ]; then
        error "Fichier docker-compose.prod.yml manquant dans $PROJECT_DIR"
    fi

    log "=== Creation des dossiers ==="
    mkdir -p nginx/conf.d certbot/conf certbot/www

    log "=== Build et lancement des conteneurs ==="
    docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

    log "=== Attente du demarrage de PostgreSQL ==="
    sleep 10

    log "=== Execution des migrations Prisma ==="
    docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

    log "=== Creation du bucket MinIO ==="
    sleep 5
    docker compose -f docker-compose.prod.yml exec minio mc alias set local http://localhost:9000 \
        $(grep MINIO_ACCESS_KEY .env.production | cut -d= -f2) \
        $(grep MINIO_SECRET_KEY .env.production | cut -d= -f2) 2>/dev/null || true
    docker compose -f docker-compose.prod.yml exec minio mc mb local/tcardio-reports 2>/dev/null || true

    log ""
    log "========================================="
    log " Deploiement termine !"
    log " Application: http://$DOMAIN"
    log "========================================="
    log ""
    log "Prochaine etape: ./deploy.sh ssl"
}

# ==================== SSL SETUP ====================
setup_ssl() {
    log "=== Configuration SSL avec Let's Encrypt ==="

    cd $PROJECT_DIR

    # First, create a temporary nginx config for HTTP only (for certbot)
    cat > nginx/conf.d/default.conf << 'TMPNGINX'
server {
    listen 80;
    server_name tcardio.tibla.terrano-hosting.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
TMPNGINX

    # Reload nginx with HTTP-only config
    docker compose -f docker-compose.prod.yml restart nginx

    sleep 3

    # Get SSL certificate
    docker compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email admin@terrano-hosting.com \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN

    # Now restore full HTTPS nginx config
    log "=== Restauration config Nginx HTTPS ==="
    # Copy the production nginx config back
    cp nginx/conf.d/default.conf.bak nginx/conf.d/default.conf 2>/dev/null || \
        warn "Copier manuellement la config HTTPS dans nginx/conf.d/default.conf"

    docker compose -f docker-compose.prod.yml restart nginx

    log ""
    log "========================================="
    log " SSL configure !"
    log " Site: https://$DOMAIN"
    log "========================================="
}

# ==================== UTILITIES ====================
show_logs() {
    cd $PROJECT_DIR
    docker compose -f docker-compose.prod.yml logs -f --tail=100 ${2:-}
}

restart_service() {
    cd $PROJECT_DIR
    if [ -n "${2:-}" ]; then
        log "Redemarrage de $2..."
        docker compose -f docker-compose.prod.yml restart $2
    else
        log "Redemarrage de tous les services..."
        docker compose -f docker-compose.prod.yml restart
    fi
}

show_status() {
    cd $PROJECT_DIR
    echo ""
    log "=== Status des conteneurs ==="
    docker compose -f docker-compose.prod.yml ps
    echo ""
    log "=== Utilisation disque ==="
    df -h / | tail -1
    echo ""
    log "=== Utilisation memoire ==="
    free -h | head -2
    echo ""
    log "=== Docker disk usage ==="
    docker system df
}

# ==================== MAIN ====================
case "${1:-}" in
    setup)
        setup_server
        ;;
    deploy)
        deploy
        ;;
    ssl)
        setup_ssl
        ;;
    logs)
        show_logs "$@"
        ;;
    restart)
        restart_service "$@"
        ;;
    status)
        show_status
        ;;
    *)
        echo ""
        echo "Usage: ./deploy.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup     - Configuration initiale du serveur (Docker, firewall, swap)"
        echo "  deploy    - Build et deploiement de l'application"
        echo "  ssl       - Configuration du certificat SSL Let's Encrypt"
        echo "  logs      - Afficher les logs (optionnel: nom du service)"
        echo "  restart   - Redemarrer les services (optionnel: nom du service)"
        echo "  status    - Status des conteneurs et ressources"
        echo ""
        ;;
esac
