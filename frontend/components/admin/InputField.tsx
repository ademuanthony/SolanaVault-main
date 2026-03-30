'use client';

export function InputField({ label, name, defaultValue, value, onChange, placeholder, disabled, type = 'text' }: {
    label: string,
    name: string,
    defaultValue?: string,
    value?: string,
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void,
    placeholder?: string,
    disabled?: boolean,
    type?: string
}) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">{label}</label>
            <input
                name={name}
                type={type}
                defaultValue={defaultValue}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
                className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
        </div>
    );
}
