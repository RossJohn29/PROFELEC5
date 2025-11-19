import React, { useState, forwardRef } from 'react'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import '../Styles/PasswordInput.css'

const PasswordInput = forwardRef(function PasswordInput(props, ref) {
        const { value, onChange, className = '', placeholder, id, name, autoComplete, disabled, required, style, ...rest } = props
    const [visible, setVisible] = useState(false)
    const toggle = (e) => { e.preventDefault(); setVisible(v => !v) }
    return (
            <div className={`pw-input-wrapper`} style={{ position: 'relative', width: '100%' }}>
                <input
                ref={ref}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                id={id}
                name={name}
                autoComplete={autoComplete}
                disabled={disabled}
                required={required}
                    className={`pw-input ${className}`}
                    style={style}
                    {...rest}
            />
            <button
                aria-label={visible ? 'Hide password' : 'Show password'}
                title={visible ? 'Hide password' : 'Show password'}
                className="pw-toggle"
                onClick={toggle}
                type="button"
            >
                {visible ? <FaEyeSlash /> : <FaEye />}
            </button>
        </div>
    )
})

export default PasswordInput
