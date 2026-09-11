-- PROJ-4, AC-2: Der Kontobereich zeigt „Dabei seit" — das Registrierdatum der
-- **eigenen** Zeile. Dafür muss `authenticated` die Spalte lesen dürfen.
--
-- **Warum das eine Änderung an einer Begründung ist, nicht an einem Prinzip.**
-- Migration `0016` hat das Spaltenrecht bewusst auf `id` und `trainer_name`
-- verengt und dazu geschrieben: „`created_at` bleibt draußen: Es wird nirgends
-- im Anwendungscode gelesen (geprüft), und was niemand braucht, gehört nicht
-- herausgegeben." Das war zum 2026-09-07 richtig. Mit PROJ-4 braucht es jemand —
-- der Eigentümer selbst, in seiner Auskunft nach Art. 15 DSGVO.
--
-- **Was sich dadurch NICHT ändert:** Die Zeilen-Policy aus `0016` bleibt
-- unangetastet. Eine Sitzung liest weiterhin ausschließlich die **eigene** Zeile;
-- fremde Registrierdaten sind so wenig erreichbar wie zuvor. Erweitert wird
-- ausschließlich, was in der eigenen Zeile sichtbar ist — von zwei Spalten auf
-- drei. Die Rangliste greift ohnehin nicht auf die Tabelle zu, sondern auf
-- `leaderboard_page` (`0015`), und die gibt kein Registrierdatum heraus.
--
-- **Gefunden wurde das nicht durch Nachdenken, sondern im Browser.** Der Entwurf
-- zu PROJ-4 hielt fest, die drei Quellen seien „bereits per Row Level Security
-- auf den Eigentümer beschränkt" — und übersah, dass `0016` eine **zweite**
-- Schicht auf Spaltenebene eingezogen hat. Die Kontoseite zeigte deshalb ihren
-- Fehlerzustand statt der Daten; `tests/PROJ-4-account-narrow.spec.ts` ist beim
-- ersten Lauf darüber gestolpert.

grant select (created_at) on table public.profiles to authenticated;

comment on table public.profiles is
  'Trainerprofile. Eine Sitzung liest ausschliesslich die eigene Zeile und daraus id, trainer_name und created_at (0016, erweitert in 0018 fuer die Auskunft in PROJ-4). Fremde Trainernamen gibt es nur ueber leaderboard_page (0015) — die kontrollierte Oeffnung fuer die Rangliste. Geschrieben wird ausschliesslich vom Trigger handle_new_user (0001).';
