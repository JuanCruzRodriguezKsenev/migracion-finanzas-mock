// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent } from "@testing-library/react" ;

// Feature: Contacts
import { ContactWithPaymentMethods } from "../types" ;
import { ContactsTable }             from "./ContactsTable" ;


describe( "ContactsTable" , () => {
  const sampleContacts: ContactWithPaymentMethods[] = [
    {
      id:             "contact-1" ,
      organizationId: "org-1" ,
      name:           "Juan Pérez" ,
      email:          "juan@ejemplo.com" ,
      phone:          "11223344" ,
      notes:          "Cliente recurrente" ,
      archivedAt:     null ,
      createdAt:      new Date() ,
      updatedAt:      new Date() ,
      paymentMethods: [
        {
          id:                "pm-1" ,
          contactId:         "contact-1" ,
          financialEntityId: "fe-1" ,
          type:              "wallet" ,
          cbuCvu:            null ,
          alias:             "juan.mp" ,
          holderName:        null ,
          holderTaxId:       null ,
          isDefault:         true ,
          createdAt:         new Date() ,
          financialEntity:   {
            id:             "fe-1" ,
            organizationId: "org-1" ,
            name:           "Mercado Pago" ,
            logo:           "mercadopago" ,
            brandDomain:    "mercadopago.com.ar" ,
            color:          "#009EE3" ,
            createdAt:      new Date() ,
          } ,
        } ,
      ] ,
    } ,
  ] ;

  it( "renderiza la tabla con los datos del contacto y sus métodos de cobro" , () => {
    const handleSelect  = vi.fn() ;
    const handleEdit    = vi.fn() ;
    const handleArchive = vi.fn() ;

    render(
      <ContactsTable
        contacts={sampleContacts}
        onSelectContact={handleSelect}
        onEditContact={handleEdit}
        onArchiveContact={handleArchive}
      />
    ) ;

    expect( screen.getByText( "Juan Pérez" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "juan@ejemplo.com" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "11223344" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "juan.mp" ) ).toBeInTheDocument() ;
  } ) ;

  it( "dispara callbacks de acciones al interactuar con los botones" , () => {
    const handleSelect  = vi.fn() ;
    const handleEdit    = vi.fn() ;
    const handleArchive = vi.fn() ;

    render(
      <ContactsTable
        contacts={sampleContacts}
        onSelectContact={handleSelect}
        onEditContact={handleEdit}
        onArchiveContact={handleArchive}
      />
    ) ;

    fireEvent.click( screen.getByRole( "button" , { name: /Cuentas/ } ) ) ;
    expect( handleSelect ).toHaveBeenCalledTimes( 1 ) ;

    fireEvent.click( screen.getByRole( "button" , { name: "Editar" } ) ) ;
    expect( handleEdit ).toHaveBeenCalledTimes( 1 ) ;

    fireEvent.click( screen.getByRole( "button" , { name: "Archivar" } ) ) ;
    expect( handleArchive ).toHaveBeenCalledTimes( 1 ) ;
  } ) ;
} ) ;
