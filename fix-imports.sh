#!/bin/bash

# Encontrar todos os arquivos TypeScript
find . -type f -name "*.ts" -o -name "*.tsx" | while read file; do
  # Ignorar node_modules e dist
  if [[ $file == *"node_modules"* ]] || [[ $file == *"dist"* ]]; then
    continue
  fi
  
  # Adicionar extensão .js para importações relativas
  sed -i 's/from "\.\.\/\([^"]*\)"/from "..\/\1.js"/g' "$file"
  sed -i 's/from "\.\/\([^"]*\)"/from ".\/\1.js"/g' "$file"
  
  # Adicionar extensão .js para importações de @shared
  sed -i 's/from "@shared\/\([^"]*\)"/from "@shared\/\1.js"/g' "$file"
done 