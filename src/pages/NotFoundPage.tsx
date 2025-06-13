import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const goBack = () => {
    if (user?.role === 'admin') {
      navigate('/admin');
    } else if (user?.role === 'guard') {
      navigate('/guard');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <Shield className="mx-auto h-16 w-16 text-primary-600" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Página não encontrada</h2>
          <p className="mt-2 text-sm text-gray-600">
            A página que você tentou acessar não existe ou foi movida.
          </p>
          <div className="mt-6">
            <button
              onClick={goBack}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Voltar para o início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;