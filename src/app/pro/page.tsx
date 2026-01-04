"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapPin, Clock, Calendar, ChevronRight, User } from "lucide-react";

export default function ProDashboard() {
    const [isOnline, setIsOnline] = useState(true);
    const [presenceDeclared, setPresenceDeclared] = useState(false);

    // Mock Data (simulating fetched data from Backend)
    const nextSlot = {
        client: "Alice M.",
        service: "Coupe Classique",
        time: "14:30",
        duration: "30 min",
        price: "35€"
    };

    return (
        <div className="p-4 space-y-6 max-w-md mx-auto">

            {/* Status Card */}
            <Card className="border-0 shadow-lg bg-white overflow-hidden rounded-[24px]">
                <div className={`h-2 w-full ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} />
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Mon Statut</span>
                            <span className={`text-2xl font-black tracking-tight ${isOnline ? 'text-green-600' : 'text-slate-400'}`}>
                                {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                            </span>
                        </div>
                        <Switch
                            checked={isOnline}
                            onCheckedChange={setIsOnline}
                            className="data-[state=checked]:bg-green-500 scale-125"
                        />
                    </div>

                    {isOnline && (
                        <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                            <Button
                                variant={presenceDeclared ? "outline" : "default"}
                                className={`w-full h-12 rounded-xl font-bold ${presenceDeclared ? 'border-green-200 bg-green-50 text-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                                onClick={() => setPresenceDeclared(!presenceDeclared)}
                            >
                                {presenceDeclared ? (
                                    <>
                                        <MapPin className="mr-2 h-4 w-4" /> Présence Confirmée
                                    </>
                                ) : (
                                    "📍 Confirmer ma présence sur site"
                                )}
                            </Button>
                            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">Requis pour recevoir des clients</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Next Appointment */}
            <div className="space-y-3">
                <h2 className="text-lg font-black text-slate-800 px-1">Prochain Rendez-vous</h2>
                <Card className="border border-slate-100 shadow-sm bg-white rounded-[24px] overflow-hidden group active:scale-[0.98] transition-all cursor-pointer">
                    <CardContent className="p-0">
                        <div className="bg-blue-50 px-5 py-3 border-b border-blue-100 flex justify-between items-center">
                            <span className="text-blue-800 font-bold text-sm flex items-center gap-2">
                                <Clock size={16} /> {nextSlot.time}
                            </span>
                            <span className="text-blue-600/60 font-bold text-xs">{nextSlot.duration}</span>
                        </div>
                        <div className="p-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 mb-1">{nextSlot.service}</h3>
                                <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
                                    <User size={14} /> {nextSlot.client}
                                </div>
                            </div>
                            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <ChevronRight size={20} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stats / Performance (Placeholder) */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-slate-900 text-white border-0 shadow-lg rounded-[24px]">
                    <CardContent className="p-5 flex flex-col justify-between h-32">
                        <Calendar className="text-blue-400 mb-2" />
                        <div>
                            <div className="text-3xl font-black">4</div>
                            <div className="text-xs text-slate-400 font-bold">RDV aujourd'hui</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border border-slate-100 shadow-lg rounded-[24px]">
                    <CardContent className="p-5 flex flex-col justify-between h-32">
                        <span className="text-4xl">🏅</span>
                        <div>
                            <div className="text-xl font-black text-slate-900">4.9/5</div>
                            <div className="text-xs text-slate-400 font-bold">Note moyenne</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
