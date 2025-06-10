#!/bin/bash

echo "=== Configuração de Acesso SSH para o Projeto CNVidas ==="
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Informações do sistema
echo -e "${BLUE}Informações do Sistema:${NC}"
echo "Usuário: $(whoami)"
echo "Hostname: $(hostname)"
echo "IP Local: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)"
echo ""

# Verificar se SSH está habilitado
echo -e "${BLUE}Verificando status do SSH...${NC}"
if command -v systemsetup &> /dev/null; then
    SSH_STATUS=$(sudo systemsetup -getremotelogin 2>/dev/null | grep -o "On\|Off" || echo "Unknown")
    if [ "$SSH_STATUS" = "On" ]; then
        echo -e "${GREEN}✓ SSH está habilitado${NC}"
    else
        echo -e "${YELLOW}⚠ SSH não está habilitado${NC}"
        echo "Para habilitar, execute: sudo systemsetup -setremotelogin on"
        echo "Ou vá em: Preferências do Sistema > Compartilhamento > Login Remoto"
    fi
else
    echo -e "${YELLOW}Não foi possível verificar o status do SSH automaticamente${NC}"
    echo "Verifique em: Preferências do Sistema > Compartilhamento > Login Remoto"
fi
echo ""

# Verificar chaves SSH
echo -e "${BLUE}Verificando chaves SSH...${NC}"
if [ -f ~/.ssh/id_rsa.pub ] || [ -f ~/.ssh/id_ed25519.pub ]; then
    echo -e "${GREEN}✓ Chave SSH encontrada${NC}"
    if [ -f ~/.ssh/id_ed25519.pub ]; then
        echo "Chave pública ED25519:"
        cat ~/.ssh/id_ed25519.pub
    elif [ -f ~/.ssh/id_rsa.pub ]; then
        echo "Chave pública RSA:"
        cat ~/.ssh/id_rsa.pub
    fi
else
    echo -e "${YELLOW}⚠ Nenhuma chave SSH encontrada${NC}"
    echo "Deseja criar uma nova chave SSH? (s/n)"
    read -r CREATE_KEY
    if [ "$CREATE_KEY" = "s" ]; then
        ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)" -f ~/.ssh/id_ed25519
        echo -e "${GREEN}✓ Chave SSH criada${NC}"
        echo "Chave pública:"
        cat ~/.ssh/id_ed25519.pub
    fi
fi
echo ""

# Criar script de inicialização do projeto
echo -e "${BLUE}Criando script de inicialização do projeto...${NC}"
cat > ~/start-cnvidas.sh << 'EOL'
#!/bin/bash
# Script para iniciar o projeto CNVidas

PROJECT_DIR="$HOME/Documents/CN Vidas - Domingo 08-06/CNVidas-updated"

echo "Iniciando projeto CNVidas..."
cd "$PROJECT_DIR"

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
fi

# Iniciar o servidor
echo "Iniciando servidor..."
npm run dev

EOL

chmod +x ~/start-cnvidas.sh
echo -e "${GREEN}✓ Script criado em: ~/start-cnvidas.sh${NC}"
echo ""

# Instruções para o Termius
echo -e "${BLUE}=== Configuração no Termius ===${NC}"
echo ""
echo "1. Abra o Termius e clique em 'New Host'"
echo ""
echo "2. Preencha os campos:"
echo "   - Label: CNVidas Mac"
echo "   - Address: $(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)"
echo "   - Port: 22"
echo "   - Username: $(whoami)"
echo ""
echo "3. Em 'Authentication':"
echo "   - Escolha 'Password' e use sua senha do Mac"
echo "   - Ou escolha 'Key' e importe sua chave privada (~/.ssh/id_ed25519 ou ~/.ssh/id_rsa)"
echo ""
echo "4. Após conectar, navegue até o projeto:"
echo "   cd \"$HOME/Documents/CN Vidas - Domingo 08-06/CNVidas-updated\""
echo ""
echo "5. Para iniciar o servidor:"
echo "   npm run dev"
echo "   Ou use o script: ~/start-cnvidas.sh"
echo ""
echo -e "${YELLOW}Importante:${NC}"
echo "- Certifique-se de que seu Mac não entre em modo de suspensão"
echo "- O firewall do macOS deve permitir conexões SSH"
echo "- Para acesso externo (fora da rede local), configure port forwarding no roteador"
echo ""
echo -e "${GREEN}Configuração concluída!${NC}"