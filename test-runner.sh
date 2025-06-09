#!/bin/bash

# Script de execução de testes CNVidas - Funcionalidades do Paciente
# Autor: Assistant
# Data: 2025-06-09

echo "🏥 CNVidas - Suite de Testes das Funcionalidades do Paciente"
echo "=========================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Função de log
log() {
    local level=$1
    local message=$2
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    case $level in
        "INFO")
            echo -e "${BLUE}[${timestamp}] INFO: ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[${timestamp}] SUCCESS: ${message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}[${timestamp}] WARNING: ${message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[${timestamp}] ERROR: ${message}${NC}"
            ;;
        "SECTION")
            echo -e "${CYAN}[${timestamp}] === ${message} ===${NC}"
            ;;
    esac
}

# Verificar se os scripts existem
check_scripts() {
    log "SECTION" "Verificando scripts de teste"
    
    local scripts=("test-patient-complete.mjs" "test-patient-api.mjs" "fix-patient-issues.mjs")
    local missing=false
    
    for script in "${scripts[@]}"; do
        if [ -f "$script" ]; then
            log "SUCCESS" "Script encontrado: $script"
        else
            log "ERROR" "Script não encontrado: $script"
            missing=true
        fi
    done
    
    if [ "$missing" = true ]; then
        log "ERROR" "Scripts faltando. Execute o comando de criação dos scripts primeiro."
        exit 1
    fi
}

# Verificar dependências
check_dependencies() {
    log "SECTION" "Verificando dependências"
    
    # Verificar Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        log "SUCCESS" "Node.js encontrado: $node_version"
    else
        log "ERROR" "Node.js não encontrado. Instale Node.js primeiro."
        exit 1
    fi
    
    # Verificar npm
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        log "SUCCESS" "npm encontrado: v$npm_version"
    else
        log "ERROR" "npm não encontrado."
        exit 1
    fi
    
    # Verificar se puppeteer está instalado (opcional)
    if npm list puppeteer >/dev/null 2>&1; then
        log "SUCCESS" "Puppeteer encontrado"
    else
        log "WARNING" "Puppeteer não encontrado. Testes de interface serão limitados."
    fi
}

# Verificar se o servidor está rodando
check_server() {
    log "SECTION" "Verificando servidor"
    
    local server_url="http://localhost:5000"
    
    if curl -f -s "$server_url" >/dev/null; then
        log "SUCCESS" "Servidor está respondendo em $server_url"
        return 0
    else
        log "WARNING" "Servidor não está respondendo em $server_url"
        return 1
    fi
}

# Executar correções automáticas
run_fixes() {
    log "SECTION" "Executando correções automáticas"
    
    if [ -f "fix-patient-issues.mjs" ]; then
        node fix-patient-issues.mjs
        if [ $? -eq 0 ]; then
            log "SUCCESS" "Correções aplicadas com sucesso"
        else
            log "ERROR" "Falha ao aplicar correções"
            return 1
        fi
    else
        log "ERROR" "Script de correções não encontrado"
        return 1
    fi
}

# Executar testes de API
run_api_tests() {
    log "SECTION" "Executando testes de API"
    
    if [ -f "test-patient-api.mjs" ]; then
        node test-patient-api.mjs
        if [ $? -eq 0 ]; then
            log "SUCCESS" "Testes de API concluídos"
        else
            log "WARNING" "Testes de API concluídos com avisos"
        fi
    else
        log "ERROR" "Script de testes de API não encontrado"
        return 1
    fi
}

# Executar testes completos (interface)
run_complete_tests() {
    log "SECTION" "Executando testes completos de interface"
    
    if [ -f "test-patient-complete.mjs" ]; then
        # Verificar se puppeteer está disponível
        if npm list puppeteer >/dev/null 2>&1; then
            log "INFO" "Iniciando testes de interface..."
            node test-patient-complete.mjs
            if [ $? -eq 0 ]; then
                log "SUCCESS" "Testes de interface concluídos"
            else
                log "ERROR" "Falha nos testes de interface"
                return 1
            fi
        else
            log "WARNING" "Puppeteer não disponível. Instalando..."
            npm install puppeteer
            if [ $? -eq 0 ]; then
                log "SUCCESS" "Puppeteer instalado. Executando testes..."
                node test-patient-complete.mjs
            else
                log "ERROR" "Falha ao instalar Puppeteer"
                return 1
            fi
        fi
    else
        log "ERROR" "Script de testes completos não encontrado"
        return 1
    fi
}

# Gerar relatório resumo
generate_summary() {
    log "SECTION" "Gerando relatório resumo"
    
    local report_dir="test-reports"
    mkdir -p "$report_dir"
    
    local summary_file="$report_dir/summary-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "CNVidas - Resumo dos Testes das Funcionalidades do Paciente"
        echo "==========================================================="
        echo "Data: $(date)"
        echo ""
        echo "Arquivos de teste encontrados:"
        ls -la test-patient-*.mjs fix-patient-*.mjs 2>/dev/null || echo "Nenhum arquivo encontrado"
        echo ""
        echo "Relatórios gerados:"
        ls -la test-report-*.json 2>/dev/null || echo "Nenhum relatório encontrado"
        echo ""
        echo "Screenshots (se houver erros):"
        ls -la test-screenshots/ 2>/dev/null || echo "Nenhum screenshot encontrado"
        echo ""
        echo "Status do servidor:"
        if check_server; then
            echo "✅ Servidor ativo"
        else
            echo "❌ Servidor inativo"
        fi
    } > "$summary_file"
    
    log "SUCCESS" "Relatório resumo salvo em: $summary_file"
    
    # Mostrar conteúdo do relatório
    echo ""
    log "SECTION" "Conteúdo do Relatório"
    cat "$summary_file"
}

# Função principal
main() {
    local action=${1:-"all"}
    
    case $action in
        "check")
            check_scripts
            check_dependencies
            check_server
            ;;
        "fix")
            check_scripts
            run_fixes
            ;;
        "api")
            check_scripts
            run_api_tests
            ;;
        "complete")
            check_scripts
            check_dependencies
            if check_server; then
                run_complete_tests
            else
                log "WARNING" "Servidor não está ativo. Testes de interface podem falhar."
                read -p "Continuar mesmo assim? (y/N): " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    run_complete_tests
                fi
            fi
            ;;
        "all")
            log "SECTION" "Executando suite completa de testes"
            check_scripts
            check_dependencies
            
            # Aplicar correções primeiro
            run_fixes
            
            # Executar testes de API
            run_api_tests
            
            # Executar testes de interface se servidor estiver ativo
            if check_server; then
                run_complete_tests
            else
                log "WARNING" "Servidor inativo. Pulando testes de interface."
            fi
            
            # Gerar relatório final
            generate_summary
            ;;
        "help")
            echo "Uso: $0 [comando]"
            echo ""
            echo "Comandos disponíveis:"
            echo "  check     - Verificar scripts e dependências"
            echo "  fix       - Aplicar correções automáticas"
            echo "  api       - Executar apenas testes de API"
            echo "  complete  - Executar testes completos de interface"
            echo "  all       - Executar suite completa (padrão)"
            echo "  help      - Mostrar esta ajuda"
            echo ""
            echo "Exemplos:"
            echo "  $0 check    # Verificar ambiente"
            echo "  $0 fix      # Aplicar correções"
            echo "  $0 api      # Testar APIs"
            echo "  $0 all      # Executar tudo"
            ;;
        *)
            log "ERROR" "Comando inválido: $action"
            echo "Use '$0 help' para ver comandos disponíveis"
            exit 1
            ;;
    esac
}

# Executar função principal
main "$@"