import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

export async function confirmDiscard() {
  const res = await MySwal.fire({
    title: 'Cambios sin guardar',
    text: 'Hay cambios sin guardar. ¿Deseas descartarlos?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Descartar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    customClass: {
      popup: 'swal2-popup custom-swal'
    }
  });
  return !!res.isConfirmed;
}

export async function confirmAction({ title = 'Confirmar', text = '¿Estás seguro?', confirmText = 'Sí', cancelText = 'Cancelar', icon = 'question' } = {}) {
  const res = await MySwal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    customClass: { popup: 'swal2-popup custom-swal' }
  });
  return !!res.isConfirmed;
}
