// Sistema de Gerenciamento de Documentos Legais - CN Vidas
// Última atualização: 9 de janeiro de 2025

const LEGAL_DOCS_CONFIG = {
  version: '1.0.0',
  lastUpdate: '2025-01-09',
  
  documents: {
    termsOfUse: {
      version: '1.0.0',
      lastUpdate: '2025-01-09',
      filePath: 'legal-docs/terms-of-use.md',
      required: true,
      type: 'terms'
    },
    privacyPolicy: {
      version: '1.0.0', 
      lastUpdate: '2025-01-09',
      filePath: 'legal-docs/privacy-policy.md',
      required: true,
      type: 'privacy'
    },
    adhesionContract: {
      version: '1.0.0',
      lastUpdate: '2025-01-09',
      filePath: 'legal-docs/adhesion-contract.md',
      required: true,
      type: 'contract'
    }
  },

  // Features que requerem atualização de docs
  featureWatchList: [
    'new_plan_types',
    'payment_methods', 
    'telemedicine_features',
    'insurance_coverage',
    'partner_network',
    'data_collection',
    'emergency_services'
  ]
};

function checkDocsNeedUpdate(featureAdded) {
  const docsToUpdate = [];
  
  if (LEGAL_DOCS_CONFIG.featureWatchList.includes(featureAdded)) {
    const featureDocMapping = {
      'new_plan_types': ['adhesionContract', 'termsOfUse'],
      'payment_methods': ['adhesionContract', 'termsOfUse'],
      'telemedicine_features': ['termsOfUse', 'privacyPolicy'],
      'insurance_coverage': ['adhesionContract', 'termsOfUse'],
      'partner_network': ['termsOfUse'],
      'data_collection': ['privacyPolicy', 'termsOfUse'],
      'emergency_services': ['termsOfUse', 'adhesionContract']
    };
    
    if (featureDocMapping[featureAdded]) {
      featureDocMapping[featureAdded].forEach(doc => {
        docsToUpdate.push(LEGAL_DOCS_CONFIG.documents[doc]);
      });
    }
  }
  
  return docsToUpdate;
}

// Exemplo de uso quando uma nova feature é adicionada  
function onFeatureAdded(featureName) {
  const docsToUpdate = checkDocsNeedUpdate(featureName);
  
  if (docsToUpdate.length > 0) {
    console.warn('🚨 DOCUMENTOS LEGAIS PRECISAM SER ATUALIZADOS');
    console.log('📋 Documentos:', docsToUpdate.map(d => d.filePath));
    console.log('⏰ Prazo: 7 dias para atualização');
  }
}

module.exports = {
  LEGAL_DOCS_CONFIG,
  checkDocsNeedUpdate,
  onFeatureAdded
}; 