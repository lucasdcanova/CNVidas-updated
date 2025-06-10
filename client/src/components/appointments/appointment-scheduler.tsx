import { useState, useEffect } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, Calendar, Clock } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { cn } from '../../lib/utils';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface DayAvailability {
  date: Date;
  slots: TimeSlot[];
  dayOfWeek: string;
  formattedDate: string;
}

interface AppointmentSchedulerProps {
  doctorId: number;
  doctorName: string;
  onSelectDateTime: (date: Date, time: string) => void;
  onCancel: () => void;
}

export function AppointmentScheduler({ 
  doctorId, 
  doctorName, 
  onSelectDateTime,
  onCancel 
}: AppointmentSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDays, setAvailableDays] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfDay(new Date()));

  // Fetch availability for the next 14 days
  useEffect(() => {
    fetchAvailability();
  }, [doctorId, currentWeekStart]);

  const fetchAvailability = async () => {
    setLoading(true);
    try {
      const days: DayAvailability[] = [];
      
      // Get next 14 days of availability
      for (let i = 0; i < 14; i++) {
        const date = addDays(currentWeekStart, i);
        const formattedDate = format(date, 'yyyy-MM-dd');
        
        try {
          const response = await apiRequest('GET', `/api/doctors/${doctorId}/availability?date=${formattedDate}`);
          const data = await response.json();
          
          if (data.times && data.times.length > 0) {
            days.push({
              date,
              slots: data.times.map((time: string) => ({
                time,
                available: true
              })),
              dayOfWeek: format(date, 'EEEE', { locale: ptBR }),
              formattedDate: format(date, "d 'de' MMMM", { locale: ptBR })
            });
          }
        } catch (error) {
          console.error(`Error fetching availability for ${formattedDate}:`, error);
        }
      }
      
      setAvailableDays(days);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      onSelectDateTime(selectedDate, selectedTime);
    }
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Doctor info header */}
      <div className="text-center pb-4 border-b">
        <h3 className="text-lg font-semibold">{doctorName}</h3>
        <p className="text-sm text-gray-600 mt-1">Selecione um dia e horário disponível</p>
      </div>

      {availableDays.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Nenhum horário disponível nos próximos 14 dias</p>
          <p className="text-sm text-gray-500 mt-2">
            Por favor, tente novamente mais tarde ou escolha outro médico
          </p>
        </div>
      ) : (
        <>
          {/* Available days */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Dias disponíveis:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[240px] overflow-y-auto pr-1">
              {availableDays.map((day) => (
                <Card
                  key={day.date.toISOString()}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md p-3",
                    selectedDate && isSameDay(selectedDate, day.date)
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : "hover:border-gray-300"
                  )}
                  onClick={() => handleDateSelect(day.date)}
                >
                  <div className="text-center space-y-1">
                    <p className="text-xs text-gray-600 capitalize">{day.dayOfWeek}</p>
                    <p className="font-semibold text-sm">{day.formattedDate}</p>
                    <Badge variant="secondary" className="text-xs">
                      {day.slots.length} horários
                    </Badge>
                    {isToday(day.date) && (
                      <Badge variant="default" className="text-xs">
                        Hoje
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Time slots for selected day */}
          {selectedDate && (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Horários disponíveis em {format(selectedDate, "d 'de' MMMM", { locale: ptBR })}:
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto pr-1">
                {availableDays
                  .find(day => isSameDay(day.date, selectedDate))
                  ?.slots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "transition-all",
                        selectedTime === slot.time && "ring-2 ring-primary/20"
                      )}
                      onClick={() => handleTimeSelect(slot.time)}
                      disabled={!slot.available}
                    >
                      {slot.time}
                    </Button>
                  ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={!selectedDate || !selectedTime}
        >
          Confirmar Agendamento
        </Button>
      </div>

      {/* Selected summary */}
      {selectedDate && selectedTime && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
          <p className="text-gray-700">
            <span className="font-medium">Agendamento selecionado:</span>{' '}
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })} às {selectedTime}
          </p>
        </div>
      )}
    </div>
  );
}