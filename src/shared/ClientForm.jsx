import React, { useRef } from 'react';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

export default function ClientForm({ onSave }) {
	const { isDirty, markDirty, clearDirty, confirmIfDirty } = useUnsavedChanges(false);
	const ref = useRef();

	useOnClickOutside(ref, async () => {
		if (!isDirty) return;
		const ok = await confirmIfDirty();
		if (!ok) {
			// usuario canceló: no limpiar ni cerrar
			return;
		}
		// si confirmó, clearDirty ya fue llamado dentro de confirmIfDirty
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		// Simular guardado
		if (onSave) onSave();
		clearDirty();
		alert('Guardado (simulado)');
	};

	return (
		<div ref={ref} className="p-4 bg-white rounded shadow">
			<form onSubmit={handleSubmit} onChange={() => markDirty(true)}>
				<div className="mb-3">
					<label className="block text-sm font-medium text-gray-700">Nombre</label>
					<input name="name" className="mt-1 block w-full border rounded px-2 py-1" />
				</div>
				<div className="mb-3">
					<label className="block text-sm font-medium text-gray-700">Teléfono</label>
					<input name="phone" className="mt-1 block w-full border rounded px-2 py-1" />
				</div>
				<div className="flex gap-2">
					<button type="submit" className="btn btn-primary">Guardar</button>
					<button type="button" className="btn" onClick={async () => {
						if (!isDirty) { clearDirty(); return; }
						const ok = await confirmIfDirty();
						if (ok) clearDirty();
					}}>
						Cancelar
					</button>
				</div>
			</form>
		</div>
	);
}
