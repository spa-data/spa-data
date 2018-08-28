<!-- convert CU EAD to legible output for record checking
     (i.e., without element tags) -->

<!-- REGEX for spa-data
   capture text after colon
   :\s(.*)<
   
   capture field names
   :\s(.*)<
   
    replace(string, regex, replacement-string)
    //author/replace(., "[A-Z]", "*")

-->
<xsl:stylesheet 
    xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xs="http://www.w3.org/2001/XMLSchema"
    exclude-result-prefixes="xs"
    version="2.0">
    <xsl:output method="xml" indent="yes"/>
   
<xsl:template match="c">
   <xsl:apply-templates select="did/unittitle"></xsl:apply-templates>
   <xsl:apply-templates select="did/container"></xsl:apply-templates>  
   <xsl:apply-templates select="did/note/p[contains(text(),'Format')]"/> 
</xsl:template>
   
   <xsl:template match="did/unittitle">TITLE: <xsl:value-of select="."/><xsl:text>&#xa;</xsl:text></xsl:template>
   <xsl:template match="did/container">Container: <xsl:value-of select="."/><xsl:text>&#xa;</xsl:text></xsl:template>
   <xsl:template match="did/note"><xsl:value-of select="."/></xsl:template>   

</xsl:stylesheet>

