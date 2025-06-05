// @ts-nocheck
// Script para desabilitar o modal de erro do Vite que está causando problemas no login
// Este script é injetado através do index.html

if (window) {
  // Alterar configuração do error overlay
  window.addEventListener('load', () => {
    // Aguardar um curto tempo para garantir que o runtime do Vite esteja carregado
    setTimeout(() => {
      // Tentar desabilitar o overlay de erro se estiver disponível
      if (window.__vite_plugin_runtime_error_overlay__) {
        window.__vite_plugin_runtime_error_overlay__.disabled = true;
        console.log('Modal de erro do runtime desabilitado com sucesso');
      }
    }, 100);
  });

  // Capturar erros de WebSocket que possam estar causando o problema
  const originalWebSocket = window.WebSocket;
  /**
   * @param {string} url
   * @param {string | string[]=} protocols
   */
  window.WebSocket = function(url, protocols) {
    const socket = new originalWebSocket(url, protocols);
    
    // Adicionar tratamento de erro para evitar que a página quebre
    socket.addEventListener('error', (event) => {
      console.warn('WebSocket error interceptado:', event);
      // Evitar propagação do erro para o manipulador padrão
      event.stopImmediatePropagation();
      return false;
    });
    
    return socket;
  };
  window.WebSocket.prototype = originalWebSocket.prototype;
}