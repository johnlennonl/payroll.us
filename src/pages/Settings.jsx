import React, { useEffect, useState } from "react";
import { CITY_TAX_RATES } from "../lib/buyorders";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Settings() {
  const [rates, setRates] = useState(CITY_TAX_RATES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await getDoc(doc(db, "settings", "taxRates"));
        if (d.exists() && mounted) {
          const data = d.data();
          if (data && data.rates) setRates(data.rates);
        }
      } catch (err) {
        console.error("Error loading rates:", err);
      }
    })();
    return () => { mounted = false };
  }, []);

  const updateValue = (city, key, value) => {
    setRates(prev => ({
      ...prev,
      [city]: { ...prev[city], [key]: Number(value) }
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "taxRates"), {
        rates,
        updatedAt: serverTimestamp(),
      });
      alert('Tasas guardadas');
    } catch (err) {
      console.error(err);
      alert('Error guardando tasas');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Ajustes</h1>
        <p className="opacity-70 mt-2">Editar tasas de impuestos por ciudad (Colorado).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.keys(rates).map(city => (
          <div key={city} className="card p-3 bg-base-100">
            <div className="font-semibold mb-2">{city.replace(/_/g,' ')}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {['state','county','city','cd','rtd'].map(k => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-24 text-xs opacity-70">{k}</div>
                  <input className="input input-sm input-bordered w-full" value={rates[city][k]} onChange={(e)=>updateValue(city,k,e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Tasas'}</button>
      </div>
    </div>
  );
}
