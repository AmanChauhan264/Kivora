-- Kivora Migration: 20261114000000_enforce_journal_transaction_entries
-- Purpose: Prevent empty or unbalanced JournalTransaction from being committed.

-- 1. Function to enforce that any committed JournalTransaction has at least 2 balanced entries per currency
CREATE OR REPLACE FUNCTION check_journal_transaction_has_balanced_entries()
RETURNS TRIGGER AS $$
DECLARE
    v_unbalanced_count INT;
    v_entry_count INT;
BEGIN
    -- Check that the transaction contains at least 2 entries (one debit and one credit)
    SELECT COUNT(*) INTO v_entry_count
    FROM "JournalEntry"
    WHERE "transactionId" = NEW.id;

    IF v_entry_count < 2 THEN
        RAISE EXCEPTION 'Journal transaction % must contain at least two entries (one debit and one credit). Found % entries.', NEW.id, v_entry_count;
    END IF;

    -- Check if total debits equal total credits for each currency in this transaction
    SELECT COUNT(*) INTO v_unbalanced_count
    FROM (
        SELECT currency,
               SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END) AS balance
        FROM "JournalEntry"
        WHERE "transactionId" = NEW.id
        GROUP BY currency
        HAVING SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END) <> 0
    ) sub;

    IF v_unbalanced_count > 0 THEN
        RAISE EXCEPTION 'Journal transaction % is unbalanced: total debits do not equal total credits per currency.', NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Deferred constraint trigger on JournalTransaction
-- Evaluated at COMMIT time so multi-statement inserts within the same database transaction are permitted
DROP TRIGGER IF EXISTS "trg_journal_transaction_require_entries" ON "JournalTransaction";

CREATE CONSTRAINT TRIGGER "trg_journal_transaction_require_entries"
AFTER INSERT ON "JournalTransaction"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_journal_transaction_has_balanced_entries();

