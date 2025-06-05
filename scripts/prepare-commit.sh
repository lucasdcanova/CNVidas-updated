#!/bin/sh

# Obtém o tipo de alteração baseado nos arquivos modificados
get_change_type() {
    if git diff --cached --name-only | grep -q "\.tsx\?$"; then
        echo "feat"
    elif git diff --cached --name-only | grep -q "\.css$\|\.scss$"; then
        echo "style"
    elif git diff --cached --name-only | grep -q "\.test\.tsx\?$"; then
        echo "test"
    else
        echo "chore"
    fi
}

# Obtém o escopo baseado no diretório modificado
get_scope() {
    if git diff --cached --name-only | grep -q "^client/"; then
        echo "frontend"
    elif git diff --cached --name-only | grep -q "^server/"; then
        echo "backend"
    else
        echo "general"
    fi
}

# Gera uma mensagem de commit baseada nas alterações
generate_commit_message() {
    local change_type=$(get_change_type)
    local scope=$(get_scope)
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    
    echo "[$change_type($scope)] Alterações automáticas - $timestamp"
}

# Se não houver mensagem de commit, gera uma automaticamente
if [ -z "$(cat $1)" ]; then
    generate_commit_message > "$1"
fi 