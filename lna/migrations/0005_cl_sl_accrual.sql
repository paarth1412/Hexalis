-- Casual and Sick leave build up from the joining date: 1 day for every 51 days
-- of service, up to 7 a year (365 / 51 ≈ 7). Before this they were all given on 1 January.
UPDATE leave_types SET accrual = 'days', accrual_days = 51 WHERE name IN ('Casual leave', 'Sick leave');
