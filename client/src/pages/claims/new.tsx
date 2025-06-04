import React from "react";
import DashboardLayout from "@/components/layouts/dashboard-layout";
import ClaimForm from "@/components/forms/claim-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Breadcrumb from "@/components/ui/breadcrumb";

const NewClaim: React.FC = () => {
  return (
    <DashboardLayout title="Novo Sinistro">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Novo Sinistro</CardTitle>
            <CardDescription>
              Preencha o formulário abaixo com as informações do sinistro. Todos os campos marcados com * são obrigatórios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ClaimForm />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default NewClaim;
