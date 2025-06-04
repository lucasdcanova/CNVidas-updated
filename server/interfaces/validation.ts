export interface ValidationRule {
  field: string;
  type: 'required' | 'string' | 'number' | 'boolean' | 'date' | 'email' | 'url' | 'enum' | 'array' | 'object' | 'custom';
  message?: string;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: any[];
  custom?: (value: any) => boolean | Promise<boolean>;
  customMessage?: string;
  nested?: ValidationRule[];
}

export interface ValidationSchema {
  [key: string]: ValidationRule | ValidationSchema;
}

export interface ValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    value?: any;
  }[];
}

export interface ValidationOptions {
  abortEarly?: boolean;
  stripUnknown?: boolean;
  recursive?: boolean;
  context?: Record<string, any>;
}

export interface ValidationContext {
  path: string[];
  value: any;
  parent?: any;
  root?: any;
  options: ValidationOptions;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  path: string[];
  type: string;
  context?: Record<string, any>;
}

export interface ValidationFunction {
  (value: any, context: ValidationContext): boolean | Promise<boolean>;
}

export interface ValidationMiddleware {
  schema: ValidationSchema;
  options?: ValidationOptions;
  onError?: (errors: ValidationError[]) => void;
}

export interface ValidationPipe {
  transform(value: any, metadata: any): any | Promise<any>;
  validate(value: any, schema: ValidationSchema, options?: ValidationOptions): Promise<ValidationResult>;
} 