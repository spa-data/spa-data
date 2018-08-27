
<xsl:stylesheet
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema"
    exclude-result-prefixes="xs"
    version="2.0">

<!-- xsl for EAD data -->

    <xsl:output method="xml" indent="yes"/>


<xsl:template match="c">
    <xsl:for-each select="did">
        <xsl:apply-templates select="unittitle"/>
        <xsl:apply-templates select="p"/>
    </xsl:for-each>  


<!--

           <xsl:apply-templates select="did/note/p"</xsl:apply-templates>
             
             <xsl:apply-templates select="Sender_Address_Merged"/>
             <xsl:apply-templates select="Sender_Organization"/>
             <xsl:apply-templates select="Recipient_Address_Merged"/>
             <xsl:apply-templates select="Recipient_Organization"/>
             <xsl:apply-templates select="Extent_Pages"/>
             <xsl:apply-templates select="Language"/>
             <xsl:apply-templates select="Type"/>
             <xsl:apply-templates select="Format"/>
             <xsl:apply-templates select="Version"/>
             <xsl:apply-templates select="Notes"/>
             <xsl:apply-templates select="Provenance"></xsl:apply-templates>

             <p>Goldsmiths locator: <xsl:choose>
                 <xsl:when test="Goldsmiths_Binder[text()='Not applicable']">
                     <xsl:text>Not applicable</xsl:text>

                 </xsl:when>

                 <xsl:otherwise>
                     <xsl:apply-templates select="Goldsmiths_Binder"/>
                     <xsl:apply-templates select="Goldsmiths_Binder_Starting_Page"/>
                 </xsl:otherwise>

             </xsl:choose>&#xa;
             </p>
     </did>
 </c>-->

</xsl:template>
    
    <xsl:template match="Access_ID"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Box_No"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Folder_name"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Goldsmiths_Binder">Binder&#x20;<xsl:value-of select="."/></xsl:template>
    <xsl:template match="Goldsmiths_Binder_Starting_Page"><xsl:text>, page </xsl:text><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Exact_Unitdate"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Extent_Pages"><p>Extent: <xsl:value-of select="."/> page(s)</p></xsl:template>
    <xsl:template match="Sender_Name"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Implied_Unitdate"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Sender_Address_Merged[string-length(text())>0]"><p>Sender address: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Sender_Organization[string-length(text())>0]"><p>Sender organization: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Recipient_Name"><xsl:value-of select="."/></xsl:template>
    <xsl:template match="Recipient_Address_Merged[string-length(text())>0]"><p>Recipient address: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Recipient_Organization[string-length(text())>0]"><p>Recipient organization: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Type"><p>Document type: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Format"><p>Format: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Version"><p>Original or Copy: <xsl:value-of select="."/></p></xsl:template>    
    <xsl:template match="Language"><p>Language: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Notes[string-length(text())>0]"><p>Notes: <xsl:value-of select="."/></p></xsl:template>
    <xsl:template match="Provenance"><p>Previous holding library: <xsl:value-of select="."/></p></xsl:template>
</xsl:stylesheet>
