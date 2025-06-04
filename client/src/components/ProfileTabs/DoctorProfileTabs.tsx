import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DoctorProfileForm from "@/components/forms/DoctorProfileForm";
import PasswordChangeForm from '@/components/forms/PasswordChangeForm';
import { DoctorProfileImageUploader } from '@/components/doctors/ProfileImageUploader';

export const DoctorProfileTabs = () => {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="profile">Perfil</TabsTrigger>
        <TabsTrigger value="password">Senha</TabsTrigger>
        <TabsTrigger value="photo">Foto</TabsTrigger>
      </TabsList>
      
      <TabsContent value="profile" className="py-4">
        <DoctorProfileForm />
      </TabsContent>
      
      <TabsContent value="password" className="py-4">
        <PasswordChangeForm />
      </TabsContent>
      
      <TabsContent value="photo" className="py-4">
        <DoctorProfileImageUploader />
      </TabsContent>
    </Tabs>
  );
};